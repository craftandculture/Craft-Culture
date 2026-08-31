# Client Purchase Orders — Implementation Reference

How a client's LPO becomes a Zoho sales order, and the rules that stop it
becoming the wrong one. Source of truth when working on `_lpo`.

The manual version of this is: read the PDF, find each wine in the catalogue,
work out which lines are repacks, create those item codes in Zoho by hand, then
key the order line by line. On the reference order that is 43 lines and 13 new
codes, and every step of it is derivable.

---

## The flow

```
upload (.pdf)
  → pdfParse                     text, as the document's own layout flattens it
  → parseLpoText                 blocks parsed in code; totals checked twice
  → [ person confirms the parse against the stated grand total ]
  → matchLpoLine per line        against OUR catalogue, not the LWIN reference
  → [ person settles refusals and confirms the price against the quote ]
  → planOrderLines               repack codes, cases, case rates
  → findOrCreateWineItem         only for codes Zoho does not have
  → createSalesOrder             draft, with terms/delivery/subject
```

No model is asked to reproduce line items. The PDF text is parsed
deterministically, which is why 43 lines cost the same as 4 and nothing
truncates.

---

## Core concepts

### The document checks itself, twice

Each line states unit price and line total, and the order states a grand total.
Both are checked (`problem` per line, `computedTotalAed` against
`declaredTotalAed`) and **reported, never repaired** — an order that does not
add up is a question for the client.

A block that cannot be read goes into `skipped` rather than being dropped. A
silent under-read looks exactly like a smaller order, which is the one failure
that would not be noticed.

### Vintage and bottle size are identity, not similarity

The reference order carries eight vintages of Tignanello and six large formats.
Scoring names across vintages would let the 1996 take the 1998's stock, and a
6L Imperial reads almost identically to its 75cl sibling. Both are hard filters
in `matchLpoLine`; only the name is scored, and only within them.

### Availability is summed across every pack

A wine sits in several rows — a 3-pack, a 6-pack, loose bottles — and they are
one wine on a shelf. `matchLpoLine` sums bottles across every row sharing
wine + vintage + size, and returns those rows.

Reading stock off the single matched row reported seven lines of the reference
order unfulfillable while every bottle was in the building, filed under a
different pack. This is the same fault as the pick-list one described in
`_wms/WMS.md`; it recurs because the row you matched is the obvious thing to
read.

### Packs of one wine are not rivals

The confidence margin is measured against the nearest **different** wine. Two
packs of the same wine scoring alike is agreement, not ambiguity, and treating
it as ambiguity refuses matches that are certain.

### In transit is not on the shelf

`availableBottles` counts stock; `inboundBottles` is reported separately.
Promising in-transit stock as picked is how an order is short on the day.

---

## Guards that must not be relaxed

| Guard | Where | What it protects |
|---|---|---|
| bottle size must be 187ml–15,000ml | `parseLpoText` | a magnum read as 1.5ml |
| vintage must be 1900–2100 or NV | `parseLpoText` | a stray figure becoming an order line |
| unparsed blocks listed, not dropped | `parseLpoText` | a short read passing as a short order |
| line arithmetic reported, not corrected | `parseLpoText` | quietly rounding away a client's error |
| vintage equality | `matchLpoLine` | one vintage taking another's stock |
| bottle-size equality | `matchLpoLine` | a 6L filled from 75cl |
| availability summed across packs | `matchLpoLine` | seven false "no stock" lines |
| margin measured against a different wine | `matchLpoLine` | certain matches refused as ambiguous |
| `MIN_SCORE` / `MIN_MARGIN` | `matchLpoLine` | "Opus One" matching "Opus One Overture" |

---

## The reference order

`~/Downloads/Craft & Culture - Consignment Items - LPOCON24082026 - 24-08-2026.pdf`
(C D General Trading). Not committed — it carries the client's prices. A correct
run reads:

- **43 lines · 113 bottles · AED 125,700**, computed equal to declared
- nothing skipped, no line arithmetic disputed
- formats 75cl, 1.5L, 3L, 6L
- **43 of 43 matched**, none refused, no score below 0.75
- eight Tignanello vintages to eight distinct LWINs
- **19 lines take the last bottles** of their wine
- 13 codes Zoho does not yet have; 19 lines are repacks

Replay it after touching extraction or matching. It has already caught the
availability fault described above.

## Known gaps

- **The client's own wording is not remembered.** A name settled by hand today
  is scored from scratch on the next order. Confirmed matches should be stored
  as aliases.
- **Price is not yet checked against the originating quote** — the LPO states a
  price per bottle and the quote agreed one, and a silent disagreement is money.
- **Nothing is written to Zoho yet**; `createSalesOrder` does not exist.
