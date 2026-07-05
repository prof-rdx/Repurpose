/**
 * Sanitize an error before returning it to the client.
 *
 * Allow-list policy: only errors explicitly tagged as user-facing pass
 * through. Everything else (Postgres, PostgREST, zod, fetch, third-party SDK,
 * unknown) is logged server-side and replaced with a generic message — so
 * column names, constraint names, JWT internals, RLS hints, etc. can't leak.
 */
export class UserFacingError extends Error {
  readonly userFacing = true as const;
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

function isUserFacing(err: unknown): err is Error & { userFacing: true } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { userFacing?: unknown }).userFacing === true &&
    err instanceof Error
  );
}

export function safeErr(scope: string, err: unknown, fallback = "Something went wrong"): Error {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ scope, msg: raw }));
  if (isUserFacing(err)) return new Error(err.message);
  return new Error(fallback);
}

