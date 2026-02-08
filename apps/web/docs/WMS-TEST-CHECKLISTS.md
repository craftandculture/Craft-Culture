# WMS End-to-End Test Checklists

Manual test procedures for UAT testing of WMS flows. Test on Zebra TC27 device and desktop browser.

---

## Test Environment Setup

**Prerequisites:**
- [ ] Logged in as admin user
- [ ] Zebra ZD421 printer connected and loaded with labels
- [ ] TC27 device with barcode scanner ready
- [ ] Test shipment created in Logistics (or use existing pending shipment)
- [ ] Test locations exist (e.g., A-01-01, A-01-02, B-01-01)

**Test URLs:**
- WMS Dashboard: https://warehouse.craftculture.xyz/platform/admin/wms
- Stock Check: https://warehouse.craftculture.xyz/platform/admin/wms/stock/check
- Receive: https://warehouse.craftculture.xyz/platform/admin/wms/receive

---

## Flow 1: Receiving

### 1.1 View Pending Shipments

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Receive | See list of pending shipments | [ ] |
| 2 | Verify shipment shows: partner name, shipment #, item count, case count | All info displayed correctly | [ ] |
| 3 | Tap on a shipment | Opens shipment detail view | [ ] |

### 1.2 Receive Shipment Items

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | View shipment items list | See all items with product names, quantities | [ ] |
| 2 | Tap on first item | Opens item detail view, scrolls to top | [ ] |
| 3 | Verify item info shows: product name, LWIN/SKU, expected cases | Info matches shipment data | [ ] |
| 4 | Verify keyboard does NOT pop up automatically | No keyboard on mobile | [ ] |
| 5 | Enter received quantity (match expected) | Quantity accepted | [ ] |
| 6 | Tap "Confirm & Print Labels" | Labels generated, ZPL downloads | [ ] |
| 7 | Send ZPL to Zebra printer | Labels print correctly | [ ] |
| 8 | Verify label shows: barcode, product name, pack size, vintage, owner | All fields correct | [ ] |

### 1.3 Assign Location (Putaway)

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | After printing labels, see "Scan Bay Barcode" input | Input focused, ready for scan | [ ] |
| 2 | Scan location QR code (e.g., LOC-A-01-01) | Location recognized, shown on screen | [ ] |
| 3 | Verify location badge shows correct code | Badge displays "A-01-01" | [ ] |
| 4 | Tap "Confirm Location" | Location assigned to stock | [ ] |
| 5 | See success message | "Stock assigned to A-01-01" or similar | [ ] |

### 1.4 Complete Receiving

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Tap "Next Product" | Goes to next incomplete item | [ ] |
| 2 | Repeat steps 1.2-1.3 for remaining items | All items received | [ ] |
| 3 | After last item, tap "Complete Receiving" | Shipment marked as received | [ ] |
| 4 | Verify shipment no longer in pending list | Shipment removed from list | [ ] |
| 5 | Check Stock page - new stock visible | Stock records created | [ ] |

### 1.5 Edge Cases - Receiving

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Try scanning same location twice for same item | Error: "Location already assigned" | [ ] |
| 2 | Try scanning invalid barcode | Error: "Location not found" | [ ] |
| 3 | Rapidly scan barcode twice (double-scan) | Only processes once, no duplicate | [ ] |
| 4 | Enter 0 cases received | Handled gracefully (skip or warn) | [ ] |
| 5 | Close browser mid-receiving, reopen | Draft saved, can resume | [ ] |

---

## Flow 2: Stock Check / Cycle Count

### 2.1 Check Stock By Bay

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Stock → Check button | Opens Stock Check page | [ ] |
| 2 | Verify "By Bay" tab is selected by default | Tab highlighted | [ ] |
| 3 | See scan input with "Scan bay barcode" label | Input visible and ready | [ ] |
| 4 | Scan bay QR code (e.g., LOC-A-01-01) | Spinner shows, then results load | [ ] |
| 5 | See location badge with code | Shows "A-01-01" | [ ] |
| 6 | See list of stock items at this location | Products displayed with quantities | [ ] |
| 7 | Verify each item shows: name, vintage, pack size, LWIN, owner, case count | All info correct | [ ] |

### 2.2 Edit Stock Quantity

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Tap "Edit Qty" on a stock item | Edit mode opens with +/- buttons | [ ] |
| 2 | See current quantity in number input | Shows current case count | [ ] |
| 3 | Tap + button | Quantity increases by 1 | [ ] |
| 4 | Tap - button | Quantity decreases by 1 | [ ] |
| 5 | See change indicator (e.g., "+2 from 5") | Shows delta from original | [ ] |
| 6 | Enter reason (optional) | Text accepted | [ ] |
| 7 | Tap "Save" | Spinner, then success toast | [ ] |
| 8 | Verify quantity updated on card | Shows new quantity | [ ] |
| 9 | Tap "Cancel" on another item | Returns to view mode, no change | [ ] |

### 2.3 Reprint Labels

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | See printer icon next to "Edit Qty" button | Icon visible | [ ] |
| 2 | Tap printer icon | Spinner shows | [ ] |
| 3 | ZPL file downloads | File named "reprint-labels-X.zpl" | [ ] |
| 4 | Print ZPL on Zebra printer | Labels print correctly | [ ] |
| 5 | Verify labels match stock at location | Same barcodes as original | [ ] |

### 2.4 Check Stock By Product

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Tap "By Product" tab | Tab switches | [ ] |
| 2 | See scan input with "Scan case barcode" label | Input ready | [ ] |
| 3 | Scan a case label barcode | Spinner, then results | [ ] |
| 4 | See product header with name, LWIN, pack size | Info correct | [ ] |
| 5 | See "TOTAL STOCK" card with total cases | Sum across all locations | [ ] |
| 6 | See "By Location" breakdown | Each location with case count | [ ] |
| 7 | Tap "Done - Check Another Product" | Resets to scan input | [ ] |

### 2.5 Edge Cases - Stock Check

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Scan empty bay (no stock) | Shows "No Stock - This location is empty" | [ ] |
| 2 | Scan invalid location barcode | Error: "Location not found: XXX" | [ ] |
| 3 | Scan case that doesn't exist in WMS | "Product Not Found" message | [ ] |
| 4 | Edit quantity to 0 | Allowed (stock depleted) | [ ] |
| 5 | Tap "Select from List" | Location list appears | [ ] |
| 6 | Search locations by code | Filter works | [ ] |
| 7 | Select location from list | Same result as scanning | [ ] |

---

## Flow 3: Picking

### 3.1 Release Order to Pick

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to Admin → Zoho Sales Orders | See order list | [ ] |
| 2 | Filter by "Ready for Release" | Only invoiced orders shown | [ ] |
| 3 | Click "Release to Pick" on an order | Pick list created | [ ] |
| 4 | See success toast | "Pick list created" | [ ] |
| 5 | Navigate to WMS → Pick | See new pick list | [ ] |

### 3.2 Start Picking

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Tap on pick list | Opens pick list detail | [ ] |
| 2 | See order info, items to pick | All items listed | [ ] |
| 3 | Tap "Start Picking" or first item | Opens picking interface | [ ] |
| 4 | See "GO TO BAY [LOCATION]" instruction | Location clearly visible | [ ] |
| 5 | See product info: name, quantity needed | Correct item shown | [ ] |

### 3.3 Pick Items

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Go to suggested bay location | Physical movement | [ ] |
| 2 | Scan bay QR code to confirm location | "Location confirmed" or similar | [ ] |
| 3 | See "Scan Case Barcode" input | Ready for case scan | [ ] |
| 4 | Scan case label barcode | Case validated | [ ] |
| 5 | If wrong product, see error | "Wrong product" warning | [ ] |
| 6 | If correct product, see success | Item marked as picked | [ ] |
| 7 | Repeat for quantity needed | All cases picked | [ ] |
| 8 | Auto-advances to next item | Next product shown | [ ] |

### 3.4 Complete Pick List

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | After all items picked, see completion screen | "All items picked" | [ ] |
| 2 | Tap "Complete Pick List" | Pick list completed | [ ] |
| 3 | Stock quantities reduced | Check Stock page | [ ] |
| 4 | Order status updated | Shows "picked" or "ready to dispatch" | [ ] |

### 3.5 Edge Cases - Picking

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Scan wrong location | Error: location doesn't match | [ ] |
| 2 | Scan case from wrong product | Error: product mismatch | [ ] |
| 3 | Scan already-picked case | Error or warning | [ ] |
| 4 | Partial pick (less than needed) | Handled appropriately | [ ] |
| 5 | Cancel mid-pick | Can resume later | [ ] |

---

## Flow 4: Transfer Stock

### 4.1 Initiate Transfer

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Transfer | Transfer page opens | [ ] |
| 2 | See "Scan Source Location" input | Ready for scan | [ ] |
| 3 | Scan source bay QR code | Location loaded, stock shown | [ ] |
| 4 | Select stock item to transfer | Item selected | [ ] |
| 5 | Enter quantity to transfer | Quantity accepted | [ ] |

### 4.2 Complete Transfer

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | See "Scan Destination Location" input | Ready for scan | [ ] |
| 2 | Scan destination bay QR code | Location validated | [ ] |
| 3 | Confirm transfer | Success message | [ ] |
| 4 | Check source location | Quantity reduced | [ ] |
| 5 | Check destination location | Quantity increased | [ ] |
| 6 | Movement recorded in history | Movement log updated | [ ] |

---

## Flow 5: Zoho Sync

### 5.1 Sync Stock to Zoho

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Stock | Stock overview page | [ ] |
| 2 | Click "Sync Zoho" button | Modal/confirmation appears | [ ] |
| 3 | Run with "Dry Run" first | See what would change | [ ] |
| 4 | Review proposed changes | Adjustments listed | [ ] |
| 5 | Run actual sync | Inventory adjustment created | [ ] |
| 6 | Check Zoho Inventory | Quantities match WMS | [ ] |

---

## Mobile UX Checks

### General Mobile Experience

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | All pages responsive on TC27 screen | No horizontal scroll needed | [ ] |
| 2 | Touch targets large enough (min 44px) | Easy to tap buttons | [ ] |
| 3 | Text readable without zooming | Font size appropriate | [ ] |
| 4 | Virtual keyboard only appears when needed | Not on scan inputs | [ ] |
| 5 | Page scrolls to relevant section after actions | User sees result | [ ] |

### Scanner Integration

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Scanner input goes to focused field | Barcode captured | [ ] |
| 2 | Scanner "Enter" key triggers submit | No manual tap needed | [ ] |
| 3 | Rapid scanning handled (debounce) | No double-processing | [ ] |
| 4 | Manual entry possible when needed | Can type barcodes | [ ] |

---

## Test Sign-Off

| Flow | Tested By | Date | Device | Pass/Fail | Notes |
|------|-----------|------|--------|-----------|-------|
| Receiving | | | | | |
| Stock Check | | | | | |
| Picking | | | | | |
| Transfer | | | | | |
| Zoho Sync | | | | | |
| Mobile UX | | | | | |

**Overall Status:** [ ] Ready for Production / [ ] Issues Found

**Issues Found:**
1.
2.
3.

**Tester Signature:** ___________________ Date: ___________
