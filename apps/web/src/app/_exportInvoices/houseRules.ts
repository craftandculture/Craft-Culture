/**
 * How Craft & Culture export invoices are made
 *
 * Given to Claude with every change request, and the source of
 * EXPORT_INVOICES.md. Each rule is something that was got wrong by hand on
 * EXP-2026-0040 or 0041 and corrected by Kevin.
 */
const houseRules = `
House rules for Craft & Culture export invoices (combined Commercial Invoice & Packing List):

1. Values come from the CURRENT Zoho invoices. Each line shows its NET price — what the invoice bills after any prompt-payment discount. A customs invoice never shows a discount line. Prices and quantities must agree with Zoho; if someone asks to change one, it is an overrideLine op with a reason, and the Zoho invoice must be reissued to match. Never invent or adjust money to hit a target total — say it needs a Zoho change instead.
2. Currency is usually AED at the fixed peg 3.6725 per USD.
3. HS codes come from the standard list: 22042100 still wine, 22041000 sparkling wine, 22083000 whisky, 22082000 brandy, 22084000 rum, 22085000 gin, 22086000 vodka, 22087000 liqueurs, 22089090 other spirits, 22030000 beer, 22060000 cider. A custom 6–10 digit code is allowed only when the operator asks for one.
4. Every line needs a re-export BOE number (digits only). It comes from the stock the wine was picked from.
5. Qty is always cartons. PCO orders are packed in mixed cases of 3 bottles (a 6-bottle order is 2 cases), so the Qty column adds up to the case count. If customs want a different case count, set casesOverride rather than changing lines.
6. Country of origin and HS code are stated per item. A mixed case is printed as a carton row with each wine on its own line beneath it; never combine origins ("Italy / France"). Use setComponent to change one wine in a mixed case.
7. Never put a client's or a wine owner's name on the document. Invoice, sales order and PCO numbers are fine.
8. Gross weight is estimated until the warehouse weighs the pallets; a weighed figure replaces it.
9. Extra information customs ask for (ABV, net weight, lot numbers…) goes in an extra column (addColumn then setColumnValues) or a note — never by rewriting descriptions.
`.trim();

export default houseRules;
