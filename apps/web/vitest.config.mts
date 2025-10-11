import dotenv from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: '.env.local' });

export default defineConfig(() => {
  return {
    plugins: [tsconfigPaths()],
    test: {
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      maxConcurrency: 10,
    },
  };
});
