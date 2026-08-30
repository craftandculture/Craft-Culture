# Pricing Manager — Implementation Reference

`/platform/admin/pricing-manager`. One screen for import cost, in-bond (B2B) and
private-client pricing across landed and in-transit stock.

Most of this file is about **keys and definitions**, because that is where every
fault has come from: two places asking the same question differently, and the
difference showing up as work disappearing. Read the two sections below before
changing a query.

---

## The two questions that are not the same question

**Released** — someone has cleared this wine for sale. One flag.

**On the price list** — a customer can actually see it. Released **and** not held
for its owner **and** carrying an HS code **and** having a cost to price from.

Conflating them cost most of a day. A badge that said "on price list" while
meaning "released" sent us rebuilding the release model on a false premise; the
wines in question were held for their owner and had never been listed.

- the row badge answers **listed**, and names what is blocking when it is not
- the `Released` / `Not released` chips answer **released**
- the `On price list` / `Not on price list` chips answer **listed**, from
  `listed` defined once in `adminGetPricingProducts` and negated for the inverse

Filters combine (AND). `Released + Not on price list` is the working queue:
finished work a customer still cannot see.

---

## Keys

### Prices are pack-agnostic

`wms_product_pricing` is keyed on `lwin18`, but a price is **per bottle**, so it
belongs to the wine, vintage and bottle size — not the pack. A repacked six into
singles must inherit it. Every read joins through `lwinPakKey()`
(`1104653-2020-06-00750` → `1104653-2020-00750`); bottle size is deliberately
kept, because a magnum must not inherit a 75cl price.

**Writes must match.** They used to key on the exact LWIN18 and upsert on that
conflict, so a wine whose price row was created as a 6-pack could not be edited
from its 2-pack line: the write minted a second row nobody read, and `MAX()`
across both kept returning the old figure. Clearing a cost override did nothing
at all.

Use `writeProductPricing()` for every pricing write. It updates every row sharing
the pack-agnostic key and inserts only when there is none.

### An in-transit line is its LWIN *or its product name*

Most in-transit stock arrives from a supplier's spreadsheet with no LWIN, so the
row identifies itself as `COALESCE(lwin, product_name)`. Anything matching those
rows must use `inboundLineKey()`. Keying on the LWIN column alone matches `NULL`
and silently excludes exactly the lines that need attention most.

### "Has a cost" means three things

A manually entered import price, the shipment's own figure, **or** an override.
Asking for one of the three puts hand-priced wines into the queue of unpriced
work while their badge reads priced.

---

## Owner scoping

Margins are per owner (`wms_owner_pricing_settings`, keyed on `partner_id`) —
which is why two partner records for one business silently split its pricing.
See the duplicate-partner panel on `/platform/admin/partners`.

**Release is not per owner, and should be.** The flag lives on the pricing row,
keyed on the wine, so releasing a wine releases every owner's holding of it. A
client's consignment can be published because we listed ours.

The protection actually in force is `not_for_sale`, set on the shipment and
overridable per line — the catalogue excludes those unconditionally. Client
consignments should carry it.

A per-owner release table was built and reverted (`9789f9e9`). It depended on a
table the deploy never created, because migrations run as `postbuild` and that
step exits quietly without `DB_URL`; every filter touching it failed, the query
retried and gave up, and the screen reported "No products found" against stock
that was there. **To land it again: confirm the migration has run against
production first, then move reads and writes in one change.** Dual-write and
verify before switching reads.

---

## Editing

All five editable cells — price, override, margin, logistics, transfers — commit
on Enter, Tab, Save **and** clicking away. Only Escape discards, and it sets a
flag before changing state so a blur racing the unmount cannot commit the edit
being abandoned. Pricing a shipment is a column of edits; losing one to a stray
click is worse than any amount of confirmation.

Owner rates (In-Bond % / PC %) seed **once per owner**. They used to reseed on
every resolution of their query, so a rate typed just after picking an owner was
overwritten by the server's old value before the blur that would have saved it.

`cases` accepts **0**: a line billed as loose bottles has no case of its own.

---

## Known gaps

- **Release is per wine, not per owner** — see above.
- **The same wine held by two owners** has two costs and therefore two prices;
  the catalogue collapses them with `MAX()`, so which price a customer sees is
  arbitrary rather than chosen.
- **Landed-cost feeds pricing before freight is allocated**, so a part-costed
  shipment prices as if it were cheap.
- The landed→in-bond→PC calculation exists in three places (row render, Excel
  export, in-transit KPI totals). A fourth copy is how they start to disagree;
  pull it into one function before adding another.
