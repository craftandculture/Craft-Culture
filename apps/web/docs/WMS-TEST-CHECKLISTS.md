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

## Flow 5: Repack

### 5.1 Initiate Repack

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Repack | Repack page opens | [ ] |
| 2 | Scan source case barcode | Case info loaded | [ ] |
| 3 | See current pack size (e.g., 12×750ml) | Current config shown | [ ] |
| 4 | Select new pack size | Options available | [ ] |
| 5 | Enter repack quantity | Quantity accepted | [ ] |

### 5.2 Complete Repack

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Confirm repack operation | Processing spinner | [ ] |
| 2 | New case labels generated | ZPL downloads | [ ] |
| 3 | Print new labels | Labels correct for new pack | [ ] |
| 4 | Original stock reduced | Source depleted | [ ] |
| 5 | New stock created | Repacked stock visible | [ ] |
| 6 | Movement recorded | repack_out and repack_in movements | [ ] |

---

## Flow 6: Dispatch

### 6.1 View Dispatch Queue

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Dispatch | Dispatch page opens | [ ] |
| 2 | See list of orders ready for dispatch | Orders listed | [ ] |
| 3 | Filter by status/date | Filters work | [ ] |

### 6.2 Process Dispatch

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Select order to dispatch | Order details shown | [ ] |
| 2 | Verify all items picked | All items listed | [ ] |
| 3 | Confirm dispatch | Order marked dispatched | [ ] |
| 4 | Shipping info updated | Tracking/carrier recorded | [ ] |

---

## Flow 7: Mixed Pallets

### 7.1 Create Pallet

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to WMS → Pallets | Pallet list page opens | [ ] |
| 2 | See summary cards (Active, Sealed, Retrieved, Total) | Counts displayed | [ ] |
| 3 | Click "New" button | New pallet form opens | [ ] |
| 4 | Select owner from dropdown | Partners listed | [ ] |
| 5 | Add optional notes | Notes field accepts text | [ ] |
| 6 | Click "Create Pallet" | Pallet created, redirects to detail | [ ] |
| 7 | See pallet code (e.g., PALLET-2026-0001) | Code generated | [ ] |
| 8 | See status badge "Active" | Status correct | [ ] |

### 7.2 Add Cases to Pallet

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | See "Scan case barcode" input | Input focused | [ ] |
| 2 | Scan a valid case barcode | Spinner shows | [ ] |
| 3 | See success feedback (beep + vibration) | Audio/haptic works | [ ] |
| 4 | Case added to pallet | Total cases increases | [ ] |
| 5 | Product appears in "Contents Summary" | Grouped by product | [ ] |
| 6 | Case appears in "All Cases" list | Case ID visible | [ ] |
| 7 | Add another case (different product) | Second product appears | [ ] |
| 8 | Add third case (same as first product) | First product count increases | [ ] |

### 7.3 Remove Case from Pallet

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | In "All Cases" section, click trash icon | Confirmation or direct removal | [ ] |
| 2 | Case removed from list | Case disappears | [ ] |
| 3 | Total cases count decreases | Count updated | [ ] |
| 4 | Product count in summary updates | Grouped count correct | [ ] |

### 7.4 Seal Pallet

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | With cases on pallet, see "Seal Pallet" button | Button enabled | [ ] |
| 2 | Click "Seal Pallet" | Pallet sealed | [ ] |
| 3 | Status changes to "Sealed" | Badge updates | [ ] |
| 4 | Scan input disappears | No more case adding | [ ] |
| 5 | Remove buttons disappear | Cannot modify contents | [ ] |
| 6 | Sealed date shown in Pallet Info | Timestamp recorded | [ ] |

### 7.5 Print Pallet Label

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "Print Label" button | ZPL file downloads | [ ] |
| 2 | Filename includes pallet code | Named correctly | [ ] |
| 3 | Print on Zebra printer (4x6) | Label prints | [ ] |
| 4 | Label shows QR code (scannable) | QR readable | [ ] |
| 5 | Label shows pallet code | Code visible | [ ] |
| 6 | Label shows owner name | Owner correct | [ ] |
| 7 | Label shows total cases | Count correct | [ ] |
| 8 | Label shows contents summary | First 5 products listed | [ ] |

### 7.6 Move Pallet to Location

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "Move to Location" | Modal opens | [ ] |
| 2 | See list of available locations | Rack locations shown | [ ] |
| 3 | Select a location | Location highlighted | [ ] |
| 4 | Click "Move Pallet" | Processing spinner | [ ] |
| 5 | Success message shown | Move confirmed | [ ] |
| 6 | Location code shown on pallet detail | Code updated | [ ] |
| 7 | Movement recorded | pallet_move movement logged | [ ] |

### 7.7 View Pallet in List

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Go back to Pallets list | List page shown | [ ] |
| 2 | See pallet with updated status/location | Info correct | [ ] |
| 3 | Filter by "Sealed" status | Only sealed pallets shown | [ ] |
| 4 | Filter by "Active" status | Only active pallets shown | [ ] |
| 5 | Click pallet to view details | Detail page opens | [ ] |

### 7.8 Edge Cases - Pallets

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Scan invalid case barcode | Error: "Case not found" with buzz | [ ] |
| 2 | Scan same case twice | Error: "Case already on pallet" | [ ] |
| 3 | Try to seal empty pallet | Button disabled or warning | [ ] |
| 4 | Scan case already on another pallet | Error: "Case on another pallet" | [ ] |
| 5 | Rapidly scan same barcode (double-scan) | Only processes once | [ ] |
| 6 | Try to add case to sealed pallet | Not allowed (no scan input) | [ ] |
| 7 | Scan pallet barcode (lookup) | Pallet found and displayed | [ ] |

---

## Flow 8: Zoho Sync

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
| Repack | | | | | |
| Dispatch | | | | | |
| Mixed Pallets | | | | | |
| Zoho Sync | | | | | |
| Mobile UX | | | | | |

**Overall Status:** [ ] Ready for Production / [ ] Issues Found

**Issues Found:**
1.
2.
3.

**Tester Signature:** ___________________ Date: ___________
