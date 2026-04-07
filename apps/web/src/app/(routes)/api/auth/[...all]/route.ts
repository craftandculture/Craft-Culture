import { toNextJsHandler } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { sessions, users, verifications } from '@/database/schema';
import auth from '@/lib/better-auth/server';
import logger from '@/utils/logger';

const handler = toNextJsHandler(auth);

/**
 * Wrap GET requests with logging to diagnose magic link issues
 */
export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const isMagicLink = url.pathname.includes('magic-link');

  if (!isMagicLink) {
    return handler.GET(request);
  }

  const token = url.searchParams.get('token');
  const debugInfo: Record<string, unknown> = {
    token: token ? token.substring(0, 10) + '...' : 'missing',
    timestamp: new Date().toISOString(),
  };

  // Step 1: Direct DB check — does the token exist? Also get the value (email).
  if (token) {
    try {
      const rows = await db
        .select({
          id: verifications.id,
          identifier: verifications.identifier,
          value: verifications.value,
          expiresAt: verifications.expiresAt,
          createdAt: verifications.createdAt,
        })
        .from(verifications)
        .where(eq(verifications.identifier, token))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        debugInfo.tokenInDb = true;
        debugInfo.tokenExpired = row.expiresAt < new Date();
        debugInfo.tokenExpiresAt = row.expiresAt?.toISOString();
        debugInfo.tokenCreatedAt = row.createdAt?.toISOString();

        // Step 2: Parse the stored value to get email
        try {
          const parsed = JSON.parse(row.value) as { email?: string; name?: string };
          debugInfo.parsedEmail = parsed.email ?? 'missing';
          debugInfo.parsedName = parsed.name ?? 'missing';

          // Step 3: Look up user by email (same query Better Auth does)
          if (parsed.email) {
            const userRows = await db
              .select({
                id: users.id,
                email: users.email,
                name: users.name,
                emailVerified: users.emailVerified,
                role: users.role,
                approvalStatus: users.approvalStatus,
              })
              .from(users)
              .where(eq(users.email, parsed.email.toLowerCase()))
              .limit(1);

            if (userRows.length > 0) {
              const user = userRows[0];
              debugInfo.userFound = true;
              debugInfo.userId = user.id;
              debugInfo.userEmail = user.email;
              debugInfo.userName = user.name;
              debugInfo.userEmailVerified = user.emailVerified;
              debugInfo.userRole = user.role;
              debugInfo.userApprovalStatus = user.approvalStatus;

              // Step 4: Count existing sessions for this user
              const sessionCount = await db
                .select({ id: sessions.id })
                .from(sessions)
                .where(eq(sessions.userId, user.id))
                .limit(10);
              debugInfo.existingSessions = sessionCount.length;
            } else {
              debugInfo.userFound = false;
              debugInfo.userSearchEmail = parsed.email.toLowerCase();
            }
          }
        } catch (parseErr) {
          debugInfo.valueParseError =
            parseErr instanceof Error ? parseErr.message : 'unknown';
          debugInfo.rawValue = row.value?.substring(0, 200);
        }
      } else {
        const countResult = await db
          .select({ id: verifications.id })
          .from(verifications)
          .limit(10);
        debugInfo.tokenInDb = false;
        debugInfo.totalVerifications = countResult.length;
      }
    } catch (e) {
      debugInfo.dbError = e instanceof Error ? e.message : 'unknown';
    }
  }

  logger.info('[Auth] Magic link verify — pre-check', debugInfo);

  // Step 2: Call Better Auth
  try {
    const response = await handler.GET(request);

    // Read the response body
    const cloned = response.clone();
    let body: string | undefined;
    try {
      body = await cloned.text();
    } catch {
      body = '<unreadable>';
    }

    debugInfo.responseStatus = response.status;
    debugInfo.responseLocation = response.headers.get('location') ?? 'none';
    debugInfo.responseBody = body?.substring(0, 500);

    logger.info('[Auth] Magic link verify — result', debugInfo);

    // If 500, return debug info as visible HTML so we can diagnose
    if (response.status >= 500) {
      return new NextResponse(
        `<!DOCTYPE html>
<html><head><title>Magic Link Debug</title></head>
<body style="font-family:monospace;padding:2rem;max-width:800px;margin:0 auto">
<h2>Magic Link Verification Failed (500)</h2>
<p>This is a temporary debug page. Please screenshot this and send to Kevin.</p>
<pre>${JSON.stringify(debugInfo, null, 2)}</pre>
<hr>
<p>Response body from auth handler:</p>
<pre>${body?.substring(0, 1000) ?? 'none'}</pre>
<br><a href="/sign-in">Back to sign in</a>
</body></html>`,
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        },
      );
    }

    return response;
  } catch (error) {
    // Better Auth uses throw for redirects — check if it's a Response
    if (error instanceof Response) {
      debugInfo.redirectStatus = error.status;
      debugInfo.redirectLocation = error.headers.get('location');
      logger.info('[Auth] Magic link verify — redirect', debugInfo);
      return error;
    }

    debugInfo.thrownError = error instanceof Error ? error.message : String(error);
    debugInfo.thrownStack = error instanceof Error ? error.stack?.substring(0, 500) : undefined;
    debugInfo.thrownType = error?.constructor?.name;

    logger.error('[Auth] Magic link verify — thrown error', debugInfo);

    return new NextResponse(
      `<!DOCTYPE html>
<html><head><title>Magic Link Debug</title></head>
<body style="font-family:monospace;padding:2rem;max-width:800px;margin:0 auto">
<h2>Magic Link Verification Error (thrown)</h2>
<p>This is a temporary debug page. Please screenshot this and send to Kevin.</p>
<pre>${JSON.stringify(debugInfo, null, 2)}</pre>
<br><a href="/sign-in">Back to sign in</a>
</body></html>`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      },
    );
  }
};

export const POST = async (request: NextRequest) => {
  const url = new URL(request.url);

  try {
    return await handler.POST(request);
  } catch (error) {
    logger.error('[Auth] Error in POST handler', {
      pathname: url.pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
