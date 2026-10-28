import { syncEnvVars } from '@trigger.dev/build/extensions/core';
import { defineConfig } from '@trigger.dev/sdk';

/**
 * Read one production environment variable from the Vercel project
 *
 * Uses the deploy's VERCEL_ACCESS_TOKEN, VERCEL_PROJECT_ID and VERCEL_TEAM_ID.
 * Returns null, never throws, when any is missing or Vercel refuses, so a
 * deploy is never blocked by it.
 *
 * @param key - The variable's name
 * @returns Its decrypted production value, or null
 */
const fetchVercelEnv = async (key: string) => {
  const token = process.env.VERCEL_ACCESS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) return null;

  try {
    const team = teamId ? `?teamId=${teamId}` : '';
    const headers = { Authorization: `Bearer ${token}` };

    // The list gives ids only; one variable read by id comes back decrypted
    const listed = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${team}`, { headers });
    if (!listed.ok) return null;

    const { envs } = (await listed.json()) as {
      envs: { id: string; key: string; target?: string[] }[];
    };
    const match = envs.find((env) => env.key === key && env.target?.includes('production'));
    if (!match) return null;

    const one = await fetch(`https://api.vercel.com/v1/projects/${projectId}/env/${match.id}${team}`, { headers });
    if (!one.ok) return null;

    const { value } = (await one.json()) as { value?: string };

    return value || null;
  } catch {
    return null;
  }
};

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
        const vars: { name: string; value: string }[] = keys
          .filter((k) => process.env[k])
          .map((k) => ({ name: k, value: process.env[k]! }));

        /*
          The private file store's token lives on the Vercel project (it was
          connected there), not in CI. Jobs that read uploaded documents need
          it, so it is fetched from Vercel at deploy time, on its own, rather
          than syncing every Vercel variable over Trigger's own.
        */
        const privateBlob = await fetchVercelEnv('BLOB_PRIVATE_READ_WRITE_TOKEN');
        if (privateBlob) vars.push({ name: 'BLOB_PRIVATE_READ_WRITE_TOKEN', value: privateBlob });

        return vars;
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
