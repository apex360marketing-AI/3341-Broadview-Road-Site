/**
 * X-Admin-Key auth for the owner-portal worker.
 *
 * Same constant-time-compare pattern as ../../feed/src/auth.ts — copied
 * verbatim so this worker has zero source dependency on the public one.
 */
export function checkAdminKey(
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
