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

### 2. Receiving (⚠️ Needs Testing)
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
2. Enter received quantities per item
3. (Optional) Save draft to resume later
4. Complete receiving → creates stock records + movements

**Key Features**:
- Pack variant handling (expected 12x750ml, received 6x750ml)
- Per-item location assignment
- Idempotency check prevents duplicate stock on retry
- Case labels created automatically

**Unknowns**:
- [ ] Does pack variant detection work correctly?
- [ ] Is draft save/resume reliable?
- [ ] Are case labels created with correct barcodes?

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

### 7. Repack (⚠️ Not Tested)
**Path**: `/platform/admin/wms/repack`

**Controllers**:
- `adminRepack` - Split case configs (12-pack → 6-packs)

**Flow**:
1. Scan source case (12-pack)
2. Select target config (6-pack)
3. System creates 2 new 6-pack records
4. Old 12-pack deleted

**Unknowns**:
- [ ] Does LWIN18 change correctly for new config?
- [ ] Are case labels created for new packs?
- [ ] Is audit trail complete?

---

### 8. Picking (⚠️ Not Tested)
**Path**: `/platform/admin/wms/pick`

**Controllers**:
- `adminCreatePickList` - Create pick list from order
- `adminGetPickLists` - List all pick lists
- `adminGetPickList` - Get single pick list
- `adminAssignPickList` - Assign to picker
- `adminPickItem` - Mark item as picked
- `adminCompletePickList` - Complete picking

**Flow**:
1. Create pick list from order
2. Assign to warehouse staff
3. Staff picks items, scanning each
4. Complete when all items picked

**Unknowns**:
- [ ] How does it integrate with orders?
- [ ] Does stock reservation work?
- [ ] Is suggested location logic correct?

---

### 9. Dispatch Batching (⚠️ Not Tested)
**Path**: `/platform/admin/wms/dispatch`

**Controllers**:
- `adminCreateDispatchBatch` - Create batch for distributor
- `adminGetDispatchBatches` - List batches
- `adminGetDispatchBatch` - Get batch details
- `adminAddOrdersToBatch` - Add orders to batch
- `adminUpdateBatchStatus` - Update status

**Flow**:
1. Create batch, select distributor
2. Add orders to batch
3. Generate pick list
4. Pick items
5. Generate delivery note
6. Mark dispatched

**Unknowns**:
- [ ] Does delivery note PDF generate correctly?
- [ ] Can multiple delivery notes be generated?
- [ ] How does batch status flow work?

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

### 11. Labels (⚠️ Needs Testing)
**Path**: `/platform/admin/wms/labels`

**Controllers**:
- `adminCreateCaseLabels` - Generate case label records
- `adminGetCaseLabels` - Get labels for shipment
- `adminGetLocationLabels` - Generate location labels
- `adminMarkLabelsPrinted` - Track print status

**Utils**:
- `generateLabelZpl` - Generate ZPL code for Zebra printer
- `generateCaseLabelBarcode` - Generate case barcode string

**Unknowns**:
- [ ] Does ZPL output work with ZD421 printer?
- [ ] Is Zebra Browser Print integration working?
- [ ] Are barcodes scannable after printing?

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

### Zebra TC27 Scanner
- Keyboard wedge mode (barcode types like keyboard)
- Chrome browser for web app
- Zebra Browser Print app for label printing

### Zebra ZD421 Printer
- 4" x 2" direct thermal labels
- Bluetooth connected to TC27
- Receives ZPL commands via Browser Print

### Barcode Formats
| Type | Format | Example |
|------|--------|---------|
| Case | `CASE-{LWIN18}-{seq}` | `CASE-1010279-2015-06-00750-001` |
| Location | `LOC-{code}` | `LOC-A-01-02` |
| Batch | `BATCH-{year}-{seq}` | `BATCH-2026-0042` |

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

## Future Work (Not Implemented)

- Customer storage pallets (schema exists, UI not built)
- Storage fee billing (schema exists, UI not built)
- Cycle counting (schema exists, UI not built)
- Partner portal stock view (controller exists, UI partial)
- Zoho integration for invoices/settlements
