# Shipment Document Import — Implementation Reference

How a supplier's invoice becomes shipment lines, and the rules that stop it
becoming the wrong ones. Use this as the source of truth when working on
extraction, import, LWIN matching or FX on `_logistics`.

Every fault this flow has had was **silent**: the figures looked plausible and
went straight into landed cost, price sheets and customs paperwork. Almost
every guard below exists because something specific went wrong, and the comment
in the code names it. Do not relax one without reading why it is there.

---

## The flow

```
upload (.xlsx/.csv/.pdf)
  → readInvoiceSheet          headers, rows, footer notes, cell-format currency
  → adminExtractSheet         LLM maps headings only; rows parsed in code
  → [ user confirms currency + reconciliation panel ]
  → adminImportExtractedItems lines written as billed, then priced in USD once
  → adminAutoMatchLwins       identity from the LWIN reference
  → [ user confirms declared cartons against the shipment ]
```

A spreadsheet always takes the sheet route, whatever it was filed as. The model
is asked **only which heading means what** — a dozen strings whatever the row
count — and every row is then parsed deterministically. Asking a model to
reproduce 163 line items as JSON is what truncated the PDF path; nothing here
grows with the row count.

---

## Core concepts

### Cases are boxes, cartons are boxes, and they are not the same number

A **case** is what the supplier billed. A **carton** is what physically
travelled. On the reference invoice: 11 cases billed, 12 cartons shipped — the
twelfth is the mixed box holding the 10 loose bottles.

- a line billed as loose bottles stores `cases: 0` and keeps the **real** pack
  it came out of (3 bottles of a twelve, not a three-bottle case)
- cartons are **declared on the shipment** and never summed from the lines,
  because only the packer knows how many mixed boxes there are
- nothing may round a zero-case line up to one. `Math.max(1, …)` in this
  neighbourhood has re-invented those cartons twice

### The document is the check on the parse

The totals row and the shipping note below the table are read
(`parseDeclaredTotals`) and stored on `logistics_shipments` as `declared_*`,
apart from our own figures. The disagreement is the whole point.

`DeclaredComparison` shows both. It counts only rows with a figure on **both**
sides — a figure we cannot produce is "awaiting a count", not agreement.
Confirming is a person's act (`adminConfirmDeclaredTotals`), stamped with who
and when, and a mismatch does not block it: cases and cartons legitimately
differ.

### Currency is stated, never assumed

Priority: **cell number format** (`[$£-809]` — the sheet's own statement) →
heading symbols → the model's reading → **null**.

Null means the import refuses and asks. It used to default to USD, and because
nothing on a Wilkinson invoice names a currency, £31,018.30 was booked as
$31,018.30 with the FX control staying hidden — the shipment looked domestic.

Prices are stored **as billed** (`sourceUnitPrice`, `sourceTotal`) and
converted once at a recorded rate, so re-pricing corrects rather than compounds.
The FX control shows on every shipment and takes a currency override, so one
imported wrongly can be repaired.

### A LWIN carries the wine's identity

Latching a LWIN fills producer, region, country and vintage where they are
blank — in **both** `adminUpdateItem` and `adminAutoMatchLwins`, because the
matcher does not go through the update path. Only blanks: a lookup does not
correct a person.

Without those four fields a line reaches the warehouse as a name and a number,
invisible to anyone browsing by producer, region or year. The Product details
bar on the shipment counts them; "Fill from LWIN"
(`adminBackfillItemDetails`) is the repair.

---

## Guards that must not be relaxed

| Guard | Where | What it caught |
|---|---|---|
| `toNumber` rejects cells with two numeric groups | `adminExtractSheet` | "6x75cl" parsed as 675, then read as a bottle size |
| bottle size must be 187ml–15,000ml | `adminExtractSheet` | 75cl stored as 75,000ml |
| pack must be 1–24 | `adminExtractSheet` | a reference column read as a pack |
| line total checked against **every** basis — per bottle, per case, per-case-price-for-loose-bottles, flat | `adminExtractSheet` | 13 of 14 correct lines flagged when only one basis was tested |
| a package count is consulted **only** when the sheet has no case column | `adminExtractSheet` | "Case #" bin references summed as cases: 11 → 82 |
| cases × pack must equal bottles, else the case count is dropped | `adminExtractSheet` | same, via a different mapping |
| summary rows caught in code, not by model hint | `adminExtractSheet` | an invoice total imported as a 66th line |
| currency null rather than USD | `adminExtractSheet` → import schema | a GBP invoice booked as USD |
| `cases` accepts 0 | `adminUpdateItem` schema, sheet input | loose lines unsaveable |
| a zero-case line stays zero when a LWIN is latched | `adminUpdateItem` | 11 cases → 13 on mapping two wines |
| `totalBottles` not recomputed as `cases × pack` when cases is 0 | `adminUpdateItem` | billed bottles wiped to zero |
| LWIN18 written only when a candidate beats the runner-up by a margin | `adminAutoMatchLwins` | confident mapping of the wrong wine |

---

## LWIN matching

`MIN_SCORE 0.45`, `MIN_MARGIN 0.12`. A clear winner is arithmetic; two close
names are a judgement. Declining is correct — but the refusal now carries its
reasoning and its shortlist (`AutoMatchRow.candidates`), each composed to LWIN18
with the line's own vintage, pack and size, and each showing producer,
appellation, classification and LWIN so identically-named records can be told
apart.

**Same-wine reuse.** A wine mapped once is offered to its other lines. Names are
keyed on lowercased words with vintages stripped. A key whose words *begin*
another key counts as the same wine only when the shorter is **≥ 4 words** —
"Sassicaia, Tenuta San Guido" vs "…, Bolgheri" is one wine; "Opus One" is two
words and must not match "Opus One, Overture". Exact-key matches can be applied
in bulk; looser ones are offered marked "(check)" and never applied without a
person.

---

## The reference invoice

`~/Downloads/Craft & Culture CRA064-SI18342-21Aug2026.xlsx` (Wilkinson
Vintners). A correct extraction reads:

- 14 lines · 98 bottles · **GBP** from the cell format
- declared **11 cases · 10 loose bottles · £31,018.30 · 12 cartons · 1 pallet**
- computed 11 · 10 · £31,018.30
- packs 6x75cl, 12x75cl, 3x150cl, 1x300cl

Replay it after touching any of this. It has caught, in single passes: a
75,000ml bottle, a pack read as 675, six invented cartons, a GBP invoice booked
as USD, 82 cases from a reference column, and thirteen false warnings on a
sound invoice.

---

## Known gaps

- **PDF path** still asks the model for line items, so it truncates on long
  invoices. Prefer the supplier's workbook.
- **Landed cost** needs freight and duty allocated before `landedCostPerBottle`
  and margin populate; the invoice alone cannot fill them.
- **Receiving** has no equivalent checkpoint yet — what physically arrived is
  not compared against the declared cartons.
