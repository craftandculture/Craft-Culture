import { NextResponse } from 'next/server';

/**
 * Debug endpoint to check environment variable availability
 * TEMPORARY - Remove after debugging
 */
export const GET = () => {
  const openaiKey = process.env.OPENAI_API_KEY;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      OPENAI_API_KEY: {
        exists: !!openaiKey,
        length: openaiKey?.length ?? 0,
        prefix: openaiKey?.substring(0, 7) ?? 'not-set',
      },
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  });
};
