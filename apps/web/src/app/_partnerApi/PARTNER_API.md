# Partner Stock API (`/api/v1/account/*`)

Read-only API giving a wine partner (Cru Wine, Crurated, …) their own stock, movements, sales and reservations, so their systems can sync from ours.

- Public docs: `/docs/stock-api` (`app/(routes)/(public)/docs/stock-api/page.tsx`). Its own page, deliberately not linked to or from the catalogue docs at `/docs/api`: each audience is sent only its own integration.
- Partner guide: `docs/partner-guide/09-stock-api.md`
- OpenAPI: `/api/v1/account/openapi.json`, built from `openapi/accountApiSpec.ts`; update it in the same change as any field. The catalogue spec (`/api/v1/openapi.json`) does not include these endpoints.

## Endpoints

| Route | Reader | Notes |
|---|---|---|
| `GET /account/stock` | `data/getPartnerHoldings.ts` | `wms_stock` on `owner_id`, grouped per wine and `heldAt` (warehouse / distributor = `consignment` location) |
| `GET /account/movements` | `data/getPartnerMovementEvents.ts` | Oldest first, cursor on `(performed_at, id)` |
| `GET /account/sales` | same, `salesOnly` | Pre-filters to pick / ownership_transfer / adjust, then keeps `outcome = 'sale'` |
| `GET /account/reservations` | `data/getPartnerReservations.ts` | `owner_id`, or the stock row's owner for older unstamped holds |

Routes go through `api/v1/_utils/withPartnerKey.ts`: key → permission → rate limit → handler → request log, `Cache-Control: private, no-store`. Do not hand-roll a keyed route.

## Rules that must not be relaxed

1. **The partner comes from the key, never the request.** No route takes an owner id. Every reader takes `partnerId` from `withPartnerKey`.
2. **Movements use `partnerMovementScope`**, the same scope as the portal's stock ledger and activity feed. Movements are mostly unstamped (no owner columns), so a second scope would drift into showing one partner another's wine. Shared wines (two owners) only show stamped movements; `meta.sharedWineCount` reports how many.
3. **No counterparties** (see the partner-no-counterparty rule). Sales carry `channel` (`distributor` / `private_client` / `craft_and_culture` / `other`), never a customer or distributor name. Movement `notes` and `reasonCode` are never published; descriptions come from `classifyPartnerMovement` and `STOCK_OUT_REASONS.ownerSees`.
4. **Order references:** the partner's own PCO number, or our SO number. Another partner's PCO number is suppressed.
5. **No prices or costs.** No freight, landed cost, sale price or settlement value. Add prices only with an explicit decision on which number a partner may see.
6. **Balance signs follow the reconciler** (`received − picked + adjust + repack_in − repack_out + count`; transfers ±; dispatch and bay moves 0). A take-out (`stock_out:*`) is always a removal.
7. **A bad cursor is a 400, not a restart.** Ignoring it would re-export the whole history into the partner's system.
8. **The cursor carries Postgres's `performed_at::text`** (microseconds). A JS Date would round down and repeat the boundary row.

## Issuing access

Index → **Wine Partners** → the partner's card → **Stock API** → **Generate key** (`WinePartnerApiKeys.tsx`). Those keys carry only `read:own_stock`, so a wine partner cannot read the catalogue feed. Distributors get catalogue keys from **Licensed Distributors** (the read:own_stock box is there too, for a distributor that also holds stock). `feed:partner` is always added; it does not affect `/account/*`.

Docs are split by audience and never cross-linked: distributors get `/docs/api` + `/api/v1/openapi.json`; wine partners get `/docs/stock-api` + `/api/v1/account/openapi.json`. Both pages are `noindex`.

## Tests

`utils/classifyPartnerMovement.test.ts`, `utils/movementCursor.test.ts` (vitest; on this Mac set `ESBUILD_BINARY_PATH` to an arm64 esbuild).

## Not built yet

- Webhooks (push on sale / receipt) instead of polling
- Prices on sales (needs a decision: consignor price vs nothing)
- Sales a distributor makes from wine placed with them on consignment appear only once that sale is recorded in the WMS. Confirm with the distribution module before promising real-time distributor sell-through.
- Per-key rate limits (fixed at 60/min)
