import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertYouTubeUrl } from "@/lib/youtube.server";
import { safeErr } from "@/lib/safe-error";

// Keep the public input cap close to what processing.server.ts will actually use.
// Anything larger gets truncated, so don't accept it on the wire.
const CreateInput = z.object({
  sourceType: z.enum(["youtube", "transcript"]),
  sourceUrl: z.string().url().max(500).optional(),
  // Match the processing-side MAX_TRANSCRIPT_CHARS so the wire cap never
  // exceeds what the server will actually keep.
  transcript: z.string().max(30_000).optional(),
  title: z.string().max(200).optional(),
});

import { UserFacingError } from "@/lib/safe-error";

export const createContentJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.sourceType === "youtube") {
      if (!data.sourceUrl) throw new UserFacingError("YouTube URL required");
      try {
        assertYouTubeUrl(data.sourceUrl);
      } catch (err) {
        throw new UserFacingError(err instanceof Error ? err.message : "Invalid YouTube URL");
      }
    }
    if (data.sourceType === "transcript" && !data.transcript?.trim()) {
      throw new UserFacingError("Transcript required");
    }

    // Single transactional RPC: identity derived server-side from auth.uid(),
    // quota check + rate limit + insert + charge happen atomically.
    const { data: result, error: rpcErr } = await supabase.rpc("submit_content_job", {
      p_title: data.title ?? "",
      p_source_type: data.sourceType,
      p_source_url: data.sourceUrl ?? "",
      p_transcript: data.sourceType === "transcript" ? (data.transcript ?? "") : "",
    });
    if (rpcErr) throw safeErr("content.submit", rpcErr);
    const ResultSchema = z.object({
      ok: z.boolean(),
      reason: z.string().optional(),
      job_id: z.string().uuid().optional(),
      used: z.number().optional(),
      cap: z.number().optional(),
    });
    const r = ResultSchema.parse(result);
    if (!r.ok) {
      if (r.reason === "monthly_quota_exceeded") {
        throw new UserFacingError(
          `You've used your monthly quota of ${r.cap ?? 10} jobs. Resets on the 1st.`,
        );
      }
      if (r.reason === "rate_limited") {
        throw new UserFacingError("You're submitting jobs too quickly. Please wait a moment.");
      }
      throw new UserFacingError("Limit reached.");
    }
    if (!r.job_id) throw safeErr("content.submit", new Error("no job_id from submit_content_job"));

    // Best-effort trigger of the queue drain. Use Cloudflare waitUntil when
    // available so the request isn't cancelled before the fetch completes.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      try {
        const req = getRequest();
        const origin = new URL(req.url).origin;
        const trigger = fetch(`${origin}/api/public/hooks/process-pending-jobs`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-cron-secret": cronSecret },
          body: "{}",
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {});
        try {
          // Avoid a static type-check dep on the cloudflare:workers module —
          // it exists at runtime on Workers but not in node_modules typings.
          const mod = await import(/* @vite-ignore */ "cloudflare:workers" as string);
          (mod as { getRequestContext: () => { ctx: { waitUntil: (p: Promise<unknown>) => void } } })
            .getRequestContext()
            .ctx.waitUntil(trigger);
        } catch {
          // Not on Cloudflare or no request context — fire-and-forget fallback.
          void trigger;
        }
      } catch {
        // No request context — cron tick will pick it up.
      }
    }

    return { id: r.job_id };
  });

const LIST_LIMIT = 50;
const MONTHLY_CAP = 10;

const ListInput = z.object({ cursor: z.string().datetime().optional() }).optional();

export const listContentJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("content_jobs")
      .select("id,title,status,source_type,source_url,created_at,error_message")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT + 1);
    if (data?.cursor) q = q.lt("created_at", data.cursor);
    const { data: rowsRaw, error } = await q;
    if (error) throw safeErr("library.jobs", error);
    const rows = rowsRaw ?? [];
    const hasMore = rows.length > LIST_LIMIT;
    return { rows: hasMore ? rows.slice(0, LIST_LIMIT) : rows, hasMore };
  });

export const getLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const month = new Date().toISOString().slice(0, 7);
    let q = context.supabase
      .from("content_jobs")
      .select("id,title,status,source_type,source_url,created_at,error_message")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT + 1);
    if (data?.cursor) q = q.lt("created_at", data.cursor);
    // Only the first page needs the usage block. Subsequent infinite-query
    // pages skip the second round-trip entirely.
    const isFirstPage = !data?.cursor;
    const [jobsRes, usageRes] = await Promise.all([
      q,
      isFirstPage
        ? context.supabase
            .from("usage_monthly")
            .select("jobs_count,characters_processed,year_month")
            .eq("year_month", month)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);
    if (jobsRes.error) throw safeErr("library.jobs", jobsRes.error);
    if (usageRes.error) throw safeErr("library.usage", usageRes.error);
    const rows = jobsRes.data ?? [];
    const hasMore = rows.length > LIST_LIMIT;
    return {
      rows: hasMore ? rows.slice(0, LIST_LIMIT) : rows,
      hasMore,
      usage: isFirstPage
        ? {
            month,
            jobs_count: usageRes.data?.jobs_count ?? 0,
            characters_processed: usageRes.data?.characters_processed ?? 0,
            monthly_cap: MONTHLY_CAP,
          }
        : null,
    };
  });

/**
 * Slim polling endpoint — returns only id + status for in-flight jobs.
 * Lets the library poll a tiny payload instead of the full row set.
 */
export const getActiveJobStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("content_jobs")
      .select("id,status,updated_at")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) throw safeErr("library.active", error);
    return { rows: data ?? [] };
  });

export const getJobStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("content_jobs")
      .select("id,status,error_message,updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw safeErr("job.status", error);
    return row;
  });

export const getJobAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("content_jobs")
      .select(
        "id,title,status,source_type,source_url,error_message,blog_post,linkedin_carousel,email_newsletter,twitter_threads,transcript_truncated,created_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw safeErr("job.assets", error);
    return row;
  });

export const deleteContentJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("content_jobs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw safeErr("job.delete", error);
    return { ok: true };
  });

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const month = new Date().toISOString().slice(0, 7);
    const { data, error } = await context.supabase
      .from("usage_monthly")
      .select("jobs_count,characters_processed,year_month")
      .eq("year_month", month)
      .maybeSingle();
    if (error) throw safeErr("usage", error);
    return {
      month,
      jobs_count: data?.jobs_count ?? 0,
      characters_processed: data?.characters_processed ?? 0,
      monthly_cap: MONTHLY_CAP,
    };
  });
