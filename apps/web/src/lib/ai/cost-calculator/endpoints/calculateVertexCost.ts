import { LanguageModelUsage } from 'ai';
import { bignumber } from 'mathjs';

/**
 * Vertex pricing is based on the number of input tokens used. Less than or
 * equal to 200k tokens is considered short context, more than 200k tokens is
 * considered long context.
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/pricing
 */
export const VERTEX_COST_MAP = {
  /**
   * At the time of writing claude does not support the generateContent API on
   * vertex. (So not supported).
   */
  'claude-opus-4-1': {
    nonBatch: {
      shortContextRates: {
        inputPricePerMillionTokens: 15,
        outputPricePerMillionTokens: 75,
      },
      longContextRates: {
        inputPricePerMillionTokens: 15,
        outputPricePerMillionTokens: 75,
      },
    },
    batch: {
      shortContextRates: {
        inputPricePerMillionTokens: 7.5,
        outputPricePerMillionTokens: 37.5,
      },
      longContextRates: {
        inputPricePerMillionTokens: 7.5,
        outputPricePerMillionTokens: 37.5,
      },
    },
  },
  'claude-sonnet-4': {
    nonBatch: {
      shortContextRates: {
        inputPricePerMillionTokens: 3,
        outputPricePerMillionTokens: 15,
      },
      longContextRates: {
        inputPricePerMillionTokens: 3,
        outputPricePerMillionTokens: 15,
      },
    },
    batch: {
      shortContextRates: {
        inputPricePerMillionTokens: 1.5,
        outputPricePerMillionTokens: 7.5,
      },
      longContextRates: {
        inputPricePerMillionTokens: 1.5,
        outputPricePerMillionTokens: 7.5,
      },
    },
  },
  'gemini-2.5-flash': {
    nonBatch: {
      shortContextRates: {
        inputPricePerMillionTokens: 0.3,
        outputPricePerMillionTokens: 2.5,
      },
      longContextRates: {
        inputPricePerMillionTokens: 0.3,
        outputPricePerMillionTokens: 2.5,
      },
    },
    batch: {
      shortContextRates: {
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 1.25,
      },
      longContextRates: {
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 1.25,
      },
    },
  },
  'gemini-2.5-pro': {
    nonBatch: {
      shortContextRates: {
        inputPricePerMillionTokens: 1.25,
        outputPricePerMillionTokens: 10,
      },
      longContextRates: {
        inputPricePerMillionTokens: 2.5,
        outputPricePerMillionTokens: 15,
      },
    },
    batch: {
      shortContextRates: {
        inputPricePerMillionTokens: 0.625,
        outputPricePerMillionTokens: 5,
      },
      longContextRates: {
        inputPricePerMillionTokens: 1.25,
        outputPricePerMillionTokens: 7.5,
      },
    },
  },
} as const;

const calculateVertexCost = (
  model: keyof typeof VERTEX_COST_MAP,
  usage: LanguageModelUsage,
  batchApi = false,
) => {
  const modelPricing = VERTEX_COST_MAP[model];

  if (!modelPricing) {
    throw new Error(`Model pricing not found for ${model}`);
  }

  const pricing = modelPricing[batchApi ? 'batch' : 'nonBatch'];

  const inputTokens = bignumber(usage.inputTokens ?? 0);

  /** Vertex puts reasoning tokens in the output tokens */
  const outputTokens = bignumber(usage.outputTokens ?? 0).add(
    bignumber(usage.reasoningTokens ?? 0),
  );

  /**
   * If a query input context is longer than 200K tokens, all tokens (input and
   * output) are charged at long context rates.
   */
  const pricingModel = inputTokens.lte(200_000)
    ? pricing.shortContextRates
    : pricing.longContextRates;

  const inputCost = inputTokens
    .div(1_000_000)
    .mul(pricingModel.inputPricePerMillionTokens);

  const outputCost = outputTokens
    .div(1_000_000)
    .mul(pricingModel.outputPricePerMillionTokens);

  return {
    inputCost: inputCost.toNumber(),
    outputCost: outputCost.toNumber(),
    totalCost: inputCost.add(outputCost).toNumber(),
    inputTokens: inputTokens.toNumber(),
    outputTokens: outputTokens.toNumber(),
    totalTokens: inputTokens.add(outputTokens).toNumber(),
  };
};

export default calculateVertexCost;
