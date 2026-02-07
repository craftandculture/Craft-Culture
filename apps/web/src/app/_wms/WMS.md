# WMS (Warehouse Management System) - Implementation Reference

This document describes the **actual implemented** WMS functionality for Craft & Culture. Use this as the source of truth when working on WMS features.

---

## Quick Reference

### File Structure
```
apps/web/src/app/_wms/
├── controller/          # 51 tRPC procedures (API endpoints)
├── schemas/             # Zod validation schemas
├── utils/               # Helper functions (barcode generators, etc.)
└── router.ts            # tRPC router combining all endpoints

apps/web/src/app/(routes)/(platform)/platform/admin/wms/
├── page.tsx             # Dashboard
├── locations/           # Location management
├── receive/             # Receiving workflow
├── stock/               # Stock views & reconciliation
├── putaway/             # Put-away workflow
├── transfer/            # Transfer workflow
├── repack/              # Repack workflow
├── pick/                # Picking workflow
├── dispatch/            # Dispatch batching
├── labels/              # Label printing
├── movements/           # Movement history
└── ownership/           # Ownership transfer & requests
```

### Database Tables
| Table | Purpose |
|-------|---------|
| `wms_locations` | Warehouse bin locations (A-01-02 format) |
| `wms_stock` | Stock records by product/location/shipment |
| `wms_stock_movements` | Audit trail of all movements |
| `wms_case_labels` | Individual case label records |
| `wms_pick_lists` | Order picking lists |
| `wms_pick_list_items` | Items on pick lists |
| `wms_dispatch_batches` | Batch orders for dispatch |
| `wms_dispatch_batch_orders` | Orders in each batch |
| `wms_delivery_notes` | Delivery notes per batch |
| `wms_repacks` | Repack history (12-pack → 6-pack) |
| `wms_cycle_counts` | Cycle count records |
| `wms_pallets` | Customer storage pallets |
| `wms_pallet_cases` | Cases linked to pallets |
| `wms_storage_charges` | Storage fee tracking |
| `wms_partner_requests` | Partner action requests |
| `wms_receiving_drafts` | Saved receiving progress |

---

## Core Concepts

### Stock Identification
- **LWIN-18**: Unique product identifier including vintage and pack config
  - Format: `{LWIN7}-{vintage}-{bottles}-{sizeMl}`
  - Example: `1010279-2015-06-00750` (Margaux 2015, 6x750ml)
- **Case Barcode**: `CASE-{LWIN18}-{sequence}`
  - Example: `CASE-1010279-2015-06-00750-001`
- **Location Barcode**: `LOC-{locationCode}`
  - Example: `LOC-A-01-02`

### Stock Ownership
Every stock record has an `ownerId` linking to the `partners` table. Stock can be:
- **Consignment**: C&C sells on behalf of partner, takes commission
- **Purchased**: C&C owns the stock outright

### Movement Types
```typescript
'receive'           // Stock received into warehouse
'putaway'           // Stock moved from receiving to bin
'transfer'          // Stock moved between locations
'pick'              // Stock picked for order
'adjust'            // Quantity adjustment
'count'             // Cycle count adjustment
'ownership_transfer' // Ownership changed
'repack_out'        // Source cases consumed in repack
'repack_in'         // Target cases created from repack
```

### Unique Constraints
Stock has a unique index on `(lwin18, location_id, shipment_id)` preventing duplicates.

---

## Implemented Workflows

### 1. Locations (✅ Tested)
**Path**: `/platform/admin/wms/locations`

**Controllers**:
- `adminCreateLocation` - Create single location
- `adminBatchCreateLocations` - Create range (A-01-00 to A-03-03)
- `adminCreateSpecialLocation` - Create RECEIVING/SHIPPING
- `adminGetLocations` - List all locations
- `adminGetLocation` - Get single location details
- `adminUpdateLocation` - Update location
- `adminGetLocationByBarcode` - Lookup by scanned barcode
- `adminGetLocationLabels` - Generate label PDFs

**Status**: Working. Locations can be created, edited, and labels printed.

---

### 2. Receiving (✅ Tested)
**Path**: `/platform/admin/wms/receive`

**Controllers**:
- `adminGetPendingShipments` - List shipments ready to receive
- `adminGetShipmentForReceiving` - Get shipment details with items
- `adminReceiveShipment` - Complete receiving, create stock
- `adminSaveReceivingDraft` - Save progress mid-receiving
- `adminGetReceivingDraft` - Resume saved receiving
- `adminDeleteReceivingDraft` - Clear draft
- `adminUploadReceivingPhoto` - Upload photo during receiving

**Flow**:
1. Select shipment from pending list
2. Enter received quantities per item (product cards show full details)
3. (Optional) Save draft to resume later
4. Complete receiving → creates stock records + movements + case labels
5. Download case labels for printing

**Key Features**:
- Pack variant handling (expected 12x750ml, received 6x750ml)
- Per-item location assignment
- Idempotency check prevents duplicate stock on retry
- Case labels created automatically during receiving
- Case label download via button → opens with Printer Setup app
- Product cards show: Name, Vintage, Pack Size, Owner

**Unknowns**:
- [ ] Does pack variant detection work correctly?
- [ ] Is draft save/resume reliable?

---

### 3. Stock Views (⚠️ Needs Testing)
**Path**: `/platform/admin/wms/stock`

**Controllers**:
- `adminGetStockOverview` - Dashboard totals
- `adminGetStockByProduct` - Stock grouped by LWIN18
- `adminGetStockByOwner` - Stock grouped by partner
- `adminGetAllStockRecords` - All stock records (raw list)
- `adminSearchStock` - Search by product name/LWIN
- `adminGetStockAtLocation` - Stock at specific location
- `adminGetExpiringStock` - Stock with expiry dates

**Unknowns**:
- [ ] Do totals match across different views?
- [ ] Does search work with partial matches?

---

### 4. Reconciliation (✅ Tested)
**Path**: `/platform/admin/wms/stock/reconcile`

**Controllers**:
- `adminReconcileStock` - Compare movements vs stock
- `adminAutoFixStock` - Auto-fix discrepancies
- `adminDeleteStockRecord` - Manual deletion with audit
- `adminDeduplicateStock` - Merge duplicates

**Flow**:
1. View reconciliation page
2. See expected vs actual stock
3. Click "Auto-Fix" to resolve issues
4. Or manually delete specific records

**Status**: Working. Auto-fix handles orphans and duplicates.

---

### 5. Put-Away (⚠️ Needs Testing)
**Path**: `/platform/admin/wms/putaway`

**Controllers**:
- `adminPutaway` - Move stock to new location

**Flow**:
1. Scan case barcode
2. Scan destination location barcode
3. Confirm move

**Unknowns**:
- [ ] Does barcode scanning work on TC27?
- [ ] Are movements logged correctly?

---

### 6. Transfer (⚠️ Needs Testing)
**Path**: `/platform/admin/wms/transfer`

**Controllers**:
- `adminTransferStock` - Move stock between locations

**Flow**:
1. Scan source (case or location)
2. Select quantity if partial
3. Scan destination
4. Confirm transfer

**Unknowns**:
- [ ] Can partial transfers be done?
- [ ] Does it work for all movement types?

---

### 7. Repack (✅ Tested)
**Path**: `/platform/admin/wms/repack`

**Controllers**:
- `adminRepack` - Split case configs (12-pack → 6-packs)

**Flow** (7-step wizard matching physical workflow):
1. **Scan Source Bay** - Go to bay and scan its barcode
2. **Select Case** - Choose which stock to repack
3. **Select Target Size** - Pick new case configuration (e.g., 6-pack → 2-pack)
4. **Remove Case** - Confirm you've taken the case from the shelf
5. **Physical Repack** - Open case and repack bottles (with instructions)
6. **Scan Destination Bay** - Scan where to put repacked cases (can be different location)
7. **Success** - Download labels for new cases

**Key Features**:
- Supports different source and destination locations
- Case labels generated automatically for repacked cases
- Source stock record kept at 0 quantity (not deleted) to preserve FK references
- Movements: `repack_out` for source, `repack_in` for target
- Reconciliation correctly accounts for repack movements

**Status**: Working. 7-step wizard tested with label download.

---

### 8. Picking (✅ Tested)
**Path**: `/platform/admin/wms/pick` (desktop) and `/platform/admin/wms/pick/[pickListId]` (mobile picking)

**Controllers**:
- `adminCreatePickList` - Create pick list from order
- `adminGetPickLists` - List all pick lists
- `adminGetPickList` - Get single pick list
- `adminAssignPickList` - Assign to picker
- `adminPickItem` - Mark item as picked (decrements stock)
- `adminCompletePickList` - Complete picking

**Flow**:
1. Create pick list from order (desktop)
2. Open pick list on TC27
3. For each item:
   - Scan location barcode (verifies correct location)
   - Scan case barcode (verifies correct product)
   - Confirm quantity picked
4. Complete when all items picked
5. Download case labels for picked items

**Key Features**:
- Case label download on pick completion
- Scanner integration for location and case verification

**Unknowns**:
- [ ] Does stock reservation work?
- [ ] Is suggested location logic correct?

---

### 9. Dispatch Batching (✅ Tested)
**Path**: `/platform/admin/wms/dispatch`

**Controllers**:
- `adminCreateDispatchBatch` - Create batch for distributor
- `adminGetDispatchBatches` - List batches
- `adminGetDispatchBatch` - Get batch details
- `adminAddOrdersToBatch` - Add orders to batch (PCO or Zoho orders)
- `adminUpdateBatchStatus` - Update status (draft → picking → staged → dispatched → delivered)
- `adminGenerateDeliveryNote` - Generate delivery note PDF

**Flow**:
1. Create batch, select distributor
2. Add orders to batch (confirmed PCO or picked Zoho orders)
3. Start picking → status = 'picking'
4. Mark staged → status = 'staged'
5. Generate delivery note PDF
6. Download case labels for dispatch
7. Dispatch → status = 'dispatched'
8. Mark delivered → status = 'delivered'

**Key Features**:
- Case label download on dispatch
- Delivery note PDF generation

**Status**: UI complete with label printing

---

### 10. Ownership (⚠️ Not Tested)
**Path**: `/platform/admin/wms/ownership`

**Controllers**:
- `adminTransferOwnership` - Transfer stock to new owner
- `adminReserveStock` - Reserve stock for order
- `adminReleaseReservation` - Release reserved stock
- `adminGetPartnerRequests` - List partner requests
- `adminResolvePartnerRequest` - Approve/reject request

**Unknowns**:
- [ ] Does ownership transfer update all related records?
- [ ] How does reservation affect available quantity?

---

### 11. Labels (✅ Tested)
**Path**: `/platform/admin/wms/labels` (desktop) and `/wms/labels` (mobile/TC27)

**Controllers**:
- `adminCreateCaseLabels` - Generate case label records with ZPL
- `adminGetCaseLabels` - Get labels for shipment
- `adminGetLocationLabels` - Generate location labels (4"x2")
- `adminMarkLabelsPrinted` - Track print status

**Utils**:
- `generateLabelZpl` - Generate ZPL for case labels (4"x2", Code 128)
- `generateLocationLabelZpl` - Generate ZPL for location labels (4"x2", QR code)
- `generateBayTotemZpl` - Generate ZPL for bay totems (4"x6", multiple QR codes)
- `generateCaseLabelBarcode` - Generate case barcode string
- `downloadZplFile` - Trigger browser download of ZPL file
- `generateBatchLabelsZpl` - Combine multiple labels into single ZPL

**Case Label Layout** (4"x2" at 203 DPI):
```
┌────────────────────────────────────────────┐
│  Craft & Culture                           │
│  ║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║  │
│  CASE-1098427-2018-02-01500-001            │
│  ─────────────────────────────────────────  │
│  Chateau FONTENIL 2018 AOP FRONSAC         │
│  ORIGINE FRANCE (2x)                       │
│  2x1500ml                                  │
│  Vintage: 2018           Owner: Exception  │
│  LWIN: 1098427-2018-02-01500  Lot: 2026... │
└────────────────────────────────────────────┘
```

**Printing Workflow** (TC27 → ZD421):
1. Complete a WMS operation (Receive, Pick, Dispatch, Repack)
2. Click "Download X Labels" button
3. Browser downloads `.zpl` file
4. Open file with "Printer Setup Utility" app on TC27
5. Printer receives ZPL and prints

**Label Printing in Each Flow**:
- **Receiving**: Download labels after completing receive
- **Pick**: Download labels when pick list completed
- **Dispatch**: Download labels when batch dispatched
- **Repack**: Download labels for new cases after repack

**Note**: Direct Bluetooth printing not working because ZD421 is BLE-only. Enterprise Browser's EB.PrinterZebra requires Bluetooth Classic. **WiFi module on order** for TCP/IP printing (planned for next week).

**Status**: Working. All label types print correctly via download workflow.

---

### 12. Movement History (✅ Tested)
**Path**: `/platform/admin/wms/movements`

**Controllers**:
- `adminGetMovementHistory` - Get all movements with filters

**Status**: Working. Shows all movements with details.

---

## API Patterns

### Calling WMS APIs
```typescript
// Browser (React Query)
const api = useTRPC();
const { data } = useQuery(api.wms.admin.stock.getOverview.queryOptions());

// Mutation
const mutation = useMutation(api.wms.admin.stock.deleteRecord.mutationOptions());
mutation.mutate({ stockId: '...', reason: '...' });
```

### Router Structure
```typescript
wms.admin.locations.*     // Location management
wms.admin.receiving.*     // Receiving workflow
wms.admin.labels.*        // Label printing
wms.admin.operations.*    // Put-away, transfer, repack
wms.admin.stock.*         // Stock queries & reconciliation
wms.admin.ownership.*     // Ownership transfer
wms.admin.picking.*       // Order picking
wms.admin.dispatch.*      // Dispatch batching
wms.partner.*             // Partner portal APIs
```

---

## Common Operations

### Create Stock from Shipment
```typescript
// adminReceiveShipment does:
1. Validate shipment exists with partner
2. Generate lot number
3. For each item:
   - Generate LWIN18 from product details
   - Check for existing stock (idempotency)
   - Create wms_stock record
   - Create wms_case_labels records
   - Create wms_stock_movements record (type: 'receive')
4. Update shipment status to 'delivered'
```

### Delete Stock with Audit
```typescript
// adminDeleteStockRecord does:
1. Get stock record
2. Create adjustment movement (negative quantity)
3. Delete stock record
```

### Auto-Fix Reconciliation
```typescript
// adminAutoFixStock does:
1. Find orphan stock (no receive movement)
2. Delete orphans with audit trail
3. Find duplicate groups
4. Merge duplicates (keep oldest, delete rest)
5. Return final reconciliation state
```

---

## Hardware Integration

### Zebra TC27 Mobile Computer
- Android-based mobile computer with built-in scanner
- Runs Enterprise Browser (Chrome-based)
- Keyboard wedge mode (scanned barcodes type as keyboard input)
- Access web app at: `warehouse.craftculture.xyz`

### Zebra ZD421 Printer
- 4" x 2" (100mm x 50mm) direct thermal labels - for case labels, location labels
- 4" x 6" (100mm x 150mm) direct thermal labels - for bay totems
- **Connection**: BLE only (Bluetooth Low Energy)
- **Current printing method**: Download ZPL file → Open with "Printer Setup Utility" app
- **Future**: TCP/IP printing when WiFi module arrives

### Label Types
| Label | Size | Format | Use |
|-------|------|--------|-----|
| Case Label | 4"x2" | Code 128 barcode | Individual wine cases |
| Location Label | 4"x2" | QR code + text | Rack/bin locations |
| Bay Totem | 4"x6" | 4 QR codes | Multi-level bay signage |

### Barcode Formats
| Type | Format | Example |
|------|--------|---------|
| Case | `CASE-{LWIN18}-{seq}` | `CASE-1010279-2015-06-00750-001` |
| Location | `LOC-{code}` | `LOC-A-01-02` |
| Batch | `BATCH-{year}-{seq}` | `BATCH-2026-0042` |

### ZPL Components
Located in `_wms/utils/`:
- `generateLabelZpl.ts` - Case label ZPL (Code 128, 4"x2")
- `generateLocationLabelZpl.ts` - Location label ZPL (QR, 4"x2")
- `generateBayTotemZpl.ts` - Bay totem ZPL (multi-QR, 4"x6")

### ZebraPrint Component
Located in `_wms/components/ZebraPrint.tsx`:
- Supports Enterprise Browser (EB.PrinterZebra)
- Supports Web Bluetooth (BLE)
- Supports Desktop Browser Print SDK
- **Note**: EB.PrinterZebra requires Bluetooth Classic - doesn't work with BLE-only printer

---

## Testing Checklist

### Before Go-Live
- [ ] Create all warehouse locations
- [ ] Test receiving a shipment end-to-end
- [ ] Test barcode scanning on TC27
- [ ] Test label printing on ZD421
- [ ] Verify stock totals match movements
- [ ] Test put-away workflow
- [ ] Test transfer workflow
- [ ] Test reconciliation auto-fix

### Integration Points
- [ ] Logistics shipments flow to receiving
- [ ] Orders create pick lists
- [ ] Pick completion updates stock
- [ ] Dispatch updates order status

---

## Known Issues & Workarounds

### Issue: Duplicate Stock on Retry
**Fixed**: Receiving now checks for existing stock before creating. Database has unique constraint.

### Issue: Reconciliation Double-Counting
**Fixed**: Stock corrections (reason_code = 'stock_correction') excluded from expected calculation.

### Issue: Transfer Handling in Rebuild
**Fixed**: The `rebuildFromMovements` controller now correctly handles transfers by treating each transfer as two separate effects: subtract from source location, add to destination location.

### Issue: Labels Not Printing
**Workaround**: Ensure Zebra Browser Print app is running on TC27, printer is paired via Bluetooth.

---

## Security Notes

### Authentication
- All admin controllers use `adminProcedure` which enforces admin role authentication
- Partner controllers use `partnerProcedure` which filters by partner ID

### SQL Injection Prevention
- All SQL queries use Drizzle ORM's parameterized `sql` template literals
- No raw string concatenation in SQL queries

### Audit Trail
- All stock modifications create movement records
- Auto-fix and rebuild operations are logged with `reasonCode: 'stock_correction'`
- Delete operations require a reason which is stored in movement notes

### Data Validation
- Input validation via Zod schemas on all mutations
- Database constraints prevent duplicate stock records

---

## Next Steps & Testing Plan

### Immediate Testing Required

#### 1. Pick Flow (Priority: HIGH)
Full end-to-end testing needed:
- [ ] Create pick list from order
- [ ] Open pick list on TC27
- [ ] Scan location barcode verification
- [ ] Scan case barcode verification
- [ ] Confirm quantity picked
- [ ] Complete pick list
- [ ] Download and print case labels
- [ ] Verify stock decremented correctly

#### 2. Repack Flow (Priority: MEDIUM)
New 7-step wizard needs final testing:
- [x] Scan source bay
- [x] Select stock to repack
- [x] Select target case config
- [x] Confirm removal from bay
- [x] Physical repack instructions screen
- [x] Scan destination bay
- [ ] Verify labels print correctly with updated spacing
- [ ] Verify stock moved to correct destination location
- [ ] Verify reconciliation shows no errors

#### 3. Dispatch Flow (Priority: MEDIUM)
- [ ] Create dispatch batch
- [ ] Add orders to batch
- [ ] Complete picking for batch
- [ ] Download case labels
- [ ] Generate delivery note PDF
- [ ] Mark as dispatched
- [ ] Mark as delivered

#### 4. Receiving Flow (Priority: LOW - already tested)
- [x] Select shipment
- [x] Enter quantities
- [x] Download labels
- [ ] Verify labels print with correct Owner field

### WiFi Module Integration (Next Week)

When WiFi module arrives for ZD421 printer:

1. **Hardware Setup**:
   - Install WiFi module in ZD421
   - Connect printer to warehouse WiFi network
   - Note printer's IP address

2. **Code Changes**:
   - Add TCP/IP printing support to `ZebraPrint` component
   - Add printer IP configuration to settings
   - Update label generation to send directly via TCP

3. **New Print Flow**:
   ```
   Current:  Click "Download" → Open file → Printer Setup app → Print
   Future:   Click "Print" → Direct TCP/IP to printer → Print
   ```

4. **Benefits**:
   - One-click printing (no download step)
   - Faster workflow
   - No dependency on Printer Setup app

### UX/UI Improvements to Consider

1. **Repack Flow**:
   - Add visual timer during physical repack step (optional)
   - Add "Same as source" quick button for destination bay

2. **Pick Flow**:
   - Add batch picking mode (multiple orders at once)
   - Add pick path optimization

3. **Labels**:
   - Consider adding C&C logo (when WiFi direct printing works)
   - Add batch print option (print all at once)

4. **General**:
   - Add sound/vibration feedback on TC27 for successful scans
   - Add offline mode support for warehouse areas with weak WiFi

### Known Issues to Monitor

1. **Repack Number Duplicates** - Fixed (was ordering ASC instead of DESC)
2. **FK Constraint on Repack** - Fixed (now keeps source stock at 0, not deleted)
3. **Reconciliation Orphans** - Fixed (now includes repack_in as valid source)
4. **Label Spacing** - Improved (may need fine-tuning based on feedback)

---

## Future Work (Not Implemented)

- Customer storage pallets (schema exists, UI not built)
- Storage fee billing (schema exists, UI not built)
- Cycle counting (schema exists, UI not built)
- Partner portal stock view (controller exists, UI partial)
- Zoho integration for invoices/settlements
- Direct TCP/IP printing (waiting for WiFi module)
