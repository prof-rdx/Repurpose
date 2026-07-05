import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Public hook invoked by pg_cron. Drains the jobs_queue table.
 *
 * Authenticated with a dedicated `CRON_SECRET` (NOT the publishable key —
 * that key is public by design). pg_cron sends it in the `x-cron-secret`
 * header.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export const Route = createFileRoute("/api/public/hooks/process-pending-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          return new Response(JSON.stringify({ error: "server_misconfigured" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!provided || !safeEqual(provided, expected)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const { drainQueue } = await import("@/lib/processing.server");
          const result = await drainQueue(2);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[process-pending-jobs] drain failed", err);
          // Don't leak internal error detail to external callers (pg_cron logs).
          return new Response(
            JSON.stringify({ error: "drain_failed" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
