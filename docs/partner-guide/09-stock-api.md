# Connecting Your System: the Stock API

Your stock held by Craft & Culture, available to your own systems: what you hold, everything that happened to it, what has sold and what is held for orders. It is the same information as the **Stock** and **Activity** pages in your partner portal, in a form your ERP, stock system or spreadsheet can read automatically.

The full technical reference, with every field, is at **https://wine.craftculture.xyz/docs/stock-api**. A machine-readable description (OpenAPI 3.1) for generating a client or loading into Postman is at **https://wine.craftculture.xyz/api/v1/account/openapi.json**.

---

## 1. Getting access

1. Ask your Craft & Culture contact for an API key with the **read:own_stock** permission.
2. The key is shown **once**, when it is created. Store it in your system's secrets, never in a browser, email or shared document.
3. Send it on every request as a header: `Authorization: Bearer <your key>`.
4. If a key is exposed or a staff member leaves, ask us to revoke it and issue a new one. Revocation takes effect immediately.

Your key can only ever see your own wine. Which partner it belongs to is fixed when we issue it, and no request parameter can change that.

---

## 2. The four endpoints

| Endpoint | What it answers | Typical use |
|---|---|---|
| `GET /api/v1/account/stock` | What do we hold with C&C right now? | Nightly stock sync, dashboards |
| `GET /api/v1/account/movements` | Everything that happened to our stock | Full ledger export, audit, reconciliation |
| `GET /api/v1/account/sales` | What of ours has sold? | Sales reporting, replenishment, commission checks |
| `GET /api/v1/account/reservations` | What is held for orders and not yet picked? | Committed stock, open-order view |

Base URL: `https://wine.craftculture.xyz`

---

## 3. Keeping your system in step

Movements and sales come oldest first, in pages, with a **cursor** that marks where you got to.

1. **First run.** Call `/api/v1/account/movements?since=2026-01-01&limit=500`. Leave out `since` to receive your full history.
2. **Page through.** While `meta.hasMore` is `true`, call again with `cursor=<meta.nextCursor>`.
3. **Store the last `nextCursor`.**
4. **Every later run.** Call with that stored cursor. You receive only what has happened since, in order, with nothing skipped and nothing repeated. Store the new `nextCursor`.

Every event has a permanent `id`. If a run is interrupted and repeated, de-duplicate on it.

Polling every 15 minutes is plenty. The limit is 60 requests a minute per key.

---

## 4. Reading an event

| Field | Meaning |
|---|---|
| `type` | What happened: `received`, `picked`, `dispatched`, `transferred_in`, `transferred_out`, `taken_out_of_stock`, `count_correction`, `adjusted`, `repacked_in`, `repacked_out`, `put_away`, `moved_bay` |
| `outcome` | For stock leaving you: `sale`, `own_delivery`, `collected`, `loss_reimbursed`, `transfer` or `correction` |
| `channel` | For sales and returns, the kind of buyer: `distributor`, `private_client`, `craft_and_culture` or `other`. Buyers are never named. |
| `placedBy` | On picks, returns and sales: `you` for an order your team placed with us (your PCOs, including subscriptions), `craft_and_culture` for our sale of your stock |
| `cases`, `bottles` | How much moved |
| `balanceChangeCases`, `balanceChangeBottles` | The signed effect on the holding of this wine code (negative = left you). Opening a case to pick single bottles takes the whole case off the case code; the bottles left over arrive on the single-bottle code (`…-01-…`) as `repacked_in`. |
| `orderReference` | Your PCO number, or our sales order number, on picks, dispatches and returns. A PCO fulfilled through one of our sales orders carries the PCO number. |
| `yourReference` | Your own reference for the order, such as your sales order number. Add it under **Your reference** when placing a PCO, or on the order page at any time. |
| `wine` | LWIN-18, LWIN-11, name, vintage, case size, bottle size |

A wine leaves your balance when it is **picked**. The later **dispatched** event records the truck leaving and changes nothing, so it is never counted twice.

---

## 5. Worked example

```bash
curl -H "Authorization: Bearer $CC_API_KEY" \
  "https://wine.craftculture.xyz/api/v1/account/sales?since=2026-11-01"
```

```json
{
  "data": [
    {
      "id": "0b7c1f9e-3a52-4f7d-9a1e-2c4b5d6e7f80",
      "reference": "MOV-2026-1234",
      "occurredAt": "2026-11-20T08:41:12.000Z",
      "type": "picked",
      "direction": "out",
      "outcome": "sale",
      "channel": "distributor",
      "description": "Picked · sold to a distributor",
      "cases": 2,
      "bottles": 12,
      "balanceChangeCases": -2,
      "balanceChangeBottles": -12,
      "wine": {
        "lwin18": "1010279-2015-06-00750",
        "lwin11": "10102792015",
        "name": "Château Example 2015",
        "vintage": 2015,
        "caseSize": 6,
        "bottleSizeMl": 750
      },
      "orderReference": "SO-00184"
    }
  ],
  "meta": { "nextCursor": "MjAyNi0xMS0y…", "hasMore": false, "sharedWineCount": 0 }
}
```

---

## 6. Good to know

- **No prices.** These endpoints report quantities and events. What you are paid is on your monthly statement.
- **Wine with a distributor.** `/account/stock` shows wine placed with a distributor on consignment as `heldAt: "distributor"`. It is still yours until it sells.
- **Shared wines.** If `meta.sharedWineCount` is above zero, another owner also holds some of the same wine. History we cannot attribute to you is left out, so that wine may not reconcile exactly. Ask us and we will reconcile it with you.
- **Errors.** `400` names the parameter that is wrong. `401` means the key is missing, revoked or expired. `403` means the key lacks `read:own_stock`. `429` means slow down; wait for the `Retry-After` seconds.

Questions: **partners@craftculture.xyz**

## Returns

Wine that comes back from an order after it was picked appears as a `returned` event, in both `/account/movements` and `/account/sales`, with the same `orderReference`, `channel` and `placedBy` as the pick. Use it to credit the sale. An order cancelled before it is picked never appears as a sale.
