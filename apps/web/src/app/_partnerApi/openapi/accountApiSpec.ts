const errors = {
  400: { description: 'A query parameter is invalid; the body names which' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { description: 'The key does not carry read:own_stock' },
  429: { $ref: '#/components/responses/RateLimited' },
};

const movementParams = [
  {
    name: 'cursor',
    in: 'query',
    schema: { type: 'string' },
    description:
      'meta.nextCursor from the previous response. Continue from there; store it to sync only what is new next time. Takes precedence over since.',
  },
  {
    name: 'since',
    in: 'query',
    schema: { type: 'string', format: 'date-time' },
    description: 'Only events at or after this moment (first sync only).',
  },
  {
    name: 'until',
    in: 'query',
    schema: { type: 'string', format: 'date-time' },
    description: 'Only events before this moment.',
  },
  {
    name: 'lwin18',
    in: 'query',
    schema: { type: 'string', example: '1010279-2015-06-00750' },
    description: 'Narrow to one wine (dashed LWIN18).',
  },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
  },
];

/**
 * OpenAPI paths and schemas for the `/account/*` endpoints
 *
 * Kept beside the code it describes and merged into `/api/v1/openapi.json`,
 * so the field names here are reviewed with the data readers that emit them.
 */
const accountApiSpec = {
  paths: {
    '/account/stock': {
      get: {
        summary: 'Your stock held by Craft & Culture, right now',
        description:
          'One row per wine and place: in our bonded warehouse, or placed with a distributor on consignment (never which one). Scoped to the partner the key was issued to.',
        responses: {
          200: {
            description: 'Your holdings',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HoldingsResponse' } },
            },
          },
          ...errors,
        },
      },
    },
    '/account/movements': {
      get: {
        summary: 'Everything that happened to your stock, oldest first',
        description:
          'Received, picked, sold, transferred, corrected. Page with cursor; store meta.nextCursor and call again later to receive only new events, in order, nothing repeated.',
        parameters: movementParams,
        responses: {
          200: {
            description: 'A page of events',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/EventsResponse' } },
            },
          },
          ...errors,
        },
      },
    },
    '/account/sales': {
      get: {
        summary: 'Your wine sold out of our warehouse',
        description:
          'The same events and cursor as /account/movements: sales, and returns of them (type returned, same orderReference as the sale, to credit it). A page can hold fewer rows than limit; keep paging while meta.hasMore is true.',
        parameters: movementParams,
        responses: {
          200: {
            description: 'A page of sale events',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/EventsResponse' } },
            },
          },
          ...errors,
        },
      },
    },
    '/account/reservations': {
      get: {
        summary: 'Your stock held for orders',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'picked', 'released', 'all'], default: 'active' },
          },
          {
            name: 'updatedSince',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            description: 'Only holds created or changed at or after this moment.',
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: 'Holds, newest first',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ReservationsResponse' } },
            },
          },
          ...errors,
        },
      },
    },
  },
  schemas: {
    Wine: {
      type: 'object',
      properties: {
        lwin18: { type: 'string', example: '1010279-2015-06-00750' },
        lwin11: { type: ['string', 'null'], example: '10102792015' },
        name: { type: 'string' },
        vintage: { type: ['integer', 'null'] },
        caseSize: { type: ['integer', 'null'], description: 'Bottles per case' },
        bottleSizeMl: { type: ['integer', 'null'] },
        producer: { type: ['string', 'null'], description: '/account/stock only' },
      },
    },
    Holding: {
      type: 'object',
      properties: {
        wine: { $ref: '#/components/schemas/Wine' },
        heldAt: { type: 'string', enum: ['warehouse', 'distributor'] },
        cases: { type: 'integer', description: 'Sealed cases' },
        openBottles: { type: 'integer', description: 'Loose bottles from opened cases' },
        totalBottles: { type: 'integer' },
        reservedCases: { type: 'integer' },
        availableCases: { type: 'integer' },
        notForSale: { type: 'boolean', description: 'Held for you, not offered for sale' },
        salesArrangement: { type: ['string', 'null'], example: 'consignment' },
        firstReceivedAt: { type: ['string', 'null'], format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    HoldingsResponse: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/Holding' } },
        totals: {
          type: 'object',
          properties: {
            wines: { type: 'integer' },
            cases: { type: 'integer' },
            bottles: { type: 'integer' },
            reservedCases: { type: 'integer' },
          },
        },
        asOf: { type: 'string', format: 'date-time' },
      },
    },
    StockEvent: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Stable; use to de-duplicate' },
        reference: { type: 'string', example: 'MOV-2026-1234' },
        occurredAt: { type: 'string', format: 'date-time' },
        type: {
          type: 'string',
          enum: [
            'received', 'put_away', 'moved_bay', 'picked', 'dispatched', 'repacked_in',
            'repacked_out', 'adjusted', 'taken_out_of_stock', 'count_correction',
            'transferred_in', 'transferred_out', 'returned',
          ],
        },
        direction: { type: 'string', enum: ['in', 'out', 'none'] },
        outcome: {
          type: ['string', 'null'],
          enum: ['sale', 'own_delivery', 'collected', 'loss_reimbursed', 'transfer', 'correction', 'returned', null],
        },
        channel: {
          type: ['string', 'null'],
          enum: ['distributor', 'private_client', 'craft_and_culture', 'other', null],
          description: 'Kind of buyer, for sales and returns. Buyers are never named.',
        },
        placedBy: {
          type: ['string', 'null'],
          enum: ['you', 'craft_and_culture', null],
          description:
            'Who placed the order, on picks, returns and sales: "you" for an order your team placed with us (your PCOs, including subscriptions), "craft_and_culture" for our sale of your stock.',
        },
        description: { type: 'string', example: 'Picked · sold to a distributor' },
        cases: {
          type: 'integer',
          description: 'Whole cases in this event, unsigned. One bottle from a 6-pack is 0 cases, 1 bottle.',
        },
        bottles: { type: 'integer', description: 'Bottles in this event, unsigned. Use this as the quantity sold.' },
        balanceChangeCases: {
          type: 'integer',
          description: 'Signed effect on this wine code\'s holding, in cases',
        },
        balanceChangeBottles: {
          type: 'integer',
          description:
            'Signed effect on this wine code\'s holding, in bottles. Opening a case to pick single bottles takes the whole case off the case code (-6 for a 6-pack); the bottles left over arrive on the single-bottle code (…-01-…) as a repacked_in event. Summed per lwin18, these match /account/stock.',
        },
        wine: { $ref: '#/components/schemas/Wine' },
        orderReference: {
          type: ['string', 'null'],
          description:
            'Your PCO number, or our sales order number, on picks, dispatches and returns. A PCO fulfilled through one of our sales orders carries the PCO number.',
        },
        yourReference: {
          type: ['string', 'null'],
          description:
            'Your own reference for the order (for example your sales order number), when you have added it to the PCO. On picks, dispatches and returns of your own orders.',
        },
      },
    },
    EventsResponse: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/StockEvent' } },
        meta: {
          type: 'object',
          properties: {
            nextCursor: { type: ['string', 'null'] },
            hasMore: { type: 'boolean' },
            sharedWineCount: {
              type: 'integer',
              description: 'Wines another owner also holds; their unattributed history is withheld',
            },
          },
        },
      },
    },
    Reservation: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['active', 'picked', 'released'] },
        wine: { $ref: '#/components/schemas/Wine' },
        cases: { type: 'integer' },
        bottles: { type: 'integer' },
        order: {
          type: 'object',
          properties: {
            reference: { type: ['string', 'null'] },
            channel: { type: ['string', 'null'], enum: ['distributor', 'private_client', null] },
            isDraft: { type: 'boolean' },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        pickedAt: { type: ['string', 'null'], format: 'date-time' },
        releasedAt: { type: ['string', 'null'], format: 'date-time' },
      },
    },
    ReservationsResponse: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/Reservation' } },
        meta: {
          type: 'object',
          properties: {
            hasMore: { type: 'boolean' },
            nextOffset: { type: ['integer', 'null'] },
          },
        },
      },
    },
  },
};

export default accountApiSpec;
