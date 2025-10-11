import calculateVertexCost from './endpoints/calculateVertexCost';

const ENDPOINT_CALCULATOR_MAP = {
  vertex: calculateVertexCost,
} as const;

export const calculateModelCost = (
  provider: keyof typeof ENDPOINT_CALCULATOR_MAP,
  ...args: Parameters<
    (typeof ENDPOINT_CALCULATOR_MAP)[keyof typeof ENDPOINT_CALCULATOR_MAP]
  >
) => {
  const calculator = ENDPOINT_CALCULATOR_MAP[provider];

  if (!calculator) {
    throw new Error(`Calculator not found for ${provider}`);
  }

  return calculator(...args);
};

export default calculateModelCost;
