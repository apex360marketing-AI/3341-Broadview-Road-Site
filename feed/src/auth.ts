/**
 * X-Refresh-Key auth for the POST /refresh endpoint.
 *
 * The site/operator sends a custom `X-Refresh-Key` header whose value matches
 * the REFRESH_KEY secret set via `wrangler secret put`. Constant-time compare
 * so we don't leak key length via timing.
 */
export function checkRefreshKey(
  headerValue: string | null,
  expected: string | undefined
): boolean {
  if (!expected) return false;
  if (!headerValue) return false;
  return constantTimeEqual(headerValue.trim(), expected);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
