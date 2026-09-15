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
  /*
    Node 21 is deprecated: from 5 October 2026 a deployment on it is refused,
    and a bare 'node' means 21.

    22 rather than the 24 the notice asks for, because 24 needs the SDK taken
    from 4.3.3 to 4.6.0 and this is the config for a project whose deploys have
    been blocked since August — the next one carries a month of job changes on
    its own. 22 is LTS into 2027, is what CI already builds on, and needs
    nothing moved to get there. 24 is a separate step once that has landed.
  */
  runtime: 'node-22',
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
