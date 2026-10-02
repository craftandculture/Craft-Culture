# Export invoices

The combined **Commercial Invoice & Packing List** (EXP-YYYY-NNNN) that goes with a shipment leaving the bond. Before this tool existed they were hand-built HTML files in `cc-marketing-site/templates/` (EXP-2026-0029 to 0041). This screen replaces them.

**Screen:** Admin → Finance → Export Invoices (`/platform/admin/export-invoices`).

## Flow
1. **New export invoice:** pick the consignee, tick the invoices going out, then **Build draft**. The invoices are read live from Zoho.
2. **Check the draft** in the editor:
   - **Edit in place:** click any description, HS code, origin, pack or BOE to change it.
   - **Line panel:** the `⋯` beside a line number opens it. Use it to choose between candidate BOEs, or to change price or qty away from Zoho (a reason is required).
3. **Ask for a change:** type what customs asked for, in plain words. Claude proposes edit ops; you see their effect on the totals and checks, then **Apply**, **Save as rule** or **Discard**.
4. **Issue:** blocked while any check is an error; warnings must be acknowledged. Issuing assigns the EXP number, renders the PDF to Vercel Blob and freezes the document.

## House rules
These are in `houseRules.ts`, which is also given to Claude.
- **Current invoices:** build from the current Zoho invoices. Show net line prices (after the prompt-payment discount), with **no discount row**.
- **Currency:** AED at the fixed peg 3.6725, set per consignee in `export_consignee_profiles`.
- **HS codes:** only `22042100`, `22041000` or `22083000` (see `classifyHsCode`). Supplier and Zoho codes are ignored, except that Zoho saying sparkling is believed.
- **BOE:** comes from the stock reservation the order line took. Without one, it falls back to Stock Explorer lots of the same wine + vintage + size, zero-quantity included. Several BOEs among them → the operator chooses. Never default to the larger lot.
- **PCO orders:** packed in **mixed cases of 3** (a 6-bottle order is 2 cases). Orders with an identical selection, in any line order, share a section with qty = number of orders. **Qty is always cartons**, so the column adds up to the case count.
- **Names:** never a client or owner name on the document. Invoice and PCO numbers are fine.

## Design
- **The document is JSON:** `ExportDocument` in `schemas/exportDocumentSchema.ts`. The preview and the PDF are both drawn from it. The BOE table and totals are derived, never stored.
- **Every change is an op:** `schemas/exportOpSchema.ts`, applied by the pure `utils/applyExportOps.ts`. Each apply saves an `export_invoice_versions` row with the ops and the request text.
- **Money:** only `overrideLine` moves money. It needs a reason, and the line stays flagged ("reissue in Zoho") until the invoice agrees.
- **Stale invoices:** `export_invoice_sources` snapshots each invoice total. `findStaleSources` compares the snapshots with the synced invoices, so a reissued or voided invoice blocks issuing.
- **Standing rules:** document-wide ops saved on the consignee profile and replayed on every new draft. Line ops cannot be saved, since line ids belong to one document.

## Tests
The regression fixtures in `utils/__fixtures__/` are the real invoices behind EXP-2026-0040 and 0041.
- **EXP-0040:** must rebuild to 67 lines, 80 cases, 376 bottles, AED 231,391.34. The issued document says .33: it rounded 8,116.225 down; half-up is correct.
- **EXP-0041:** must rebuild to 36 lines and 83 cases, and to AED 111,921.09 after the operator's pack and Giscours edits.
