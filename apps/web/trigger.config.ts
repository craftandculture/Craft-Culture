import { syncEnvVars } from '@trigger.dev/build/extensions/core';
import { defineConfig } from '@trigger.dev/sdk';

export const machineConfig = {
  default: 'small-1x',
  casafariInsert: 'medium-1x',
} as const;

export default defineConfig({
  project: 'proj_hzlxlpyayhheoggbmmvs',
  build: {
    external: ['sharp'],
    extensions: [
      syncEnvVars(async () => {
        const keys = ['ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'] as const;
        return keys
          .filter((k) => process.env[k])
          .map((k) => ({ name: k, value: process.env[k]! }));
      }),
    ],
  },
  logLevel: 'log',
  runtime: 'node',
  machine: machineConfig.default,
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 5 * 60 * 60,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 5,
      factor: 1.8,
      minTimeoutInMs: 500,
      maxTimeoutInMs: 30_000,
      randomize: false,
    },
  },
  dirs: ['./src/trigger/jobs'],
});
