import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { fetchTranscript, TranscriptError } from "./transcript.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_TRANSCRIPT_CHARS = 30000;
const YOUTUBE_TIMEOUT_MS = 15_000;
// Keep total under the Worker request budget. Retries are handled by the queue.
const AI_TIMEOUT_MS = 22_000;

const OutputSchema = z.object({
  title: z.string(),
  blog_post: z
    .string()
    .describe(
      "Full SEO-optimized blog post in markdown, ~800-1200 words, with H2/H3 sections, intro, key takeaways, and conclusion.",
    ),
  linkedin_carousel: z
    .array(z.object({ heading: z.string(), body: z.string() }))
    .length(5)
    .describe("Exactly 5 LinkedIn carousel slides."),
  email_newsletter: z
    .string()
    .describe("Email newsletter with subject line on first line prefixed 'Subject: ', then body."),
  twitter_threads: z
    .array(z.array(z.string()))
    .length(3)
    .describe("Three Twitter threads. Each thread is an array of 5-8 tweets, each <=270 chars."),
});

const PROMPT_PREAMBLE = `You are a content repurposing engine. Read the transcript below and produce high-quality marketing assets.

Rules:
- Identify the 3-5 core arguments / insights.
- Write in a clear, human voice — not corporate fluff.
- Blog post: SEO-optimized markdown, real H2/H3 headings, ~1000 words.
- LinkedIn carousel: exactly 5 slides; slide 1 = hook, slides 2-4 = insights, slide 5 = CTA.
- Email newsletter: starts with "Subject: ..." line, then 200-350 word body in plain text.
- Twitter threads: 3 distinct angles, each 5-8 tweets, each tweet ≤270 chars, no numbering prefix.`;

type Phase = "claim" | "transcript" | "ai" | "persist";

interface FailureClassification {
  message: string;
  permanent: boolean;
}

function log(phase: Phase, jobId: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ scope: "processJob", phase, jobId, ...fields }));
}

class AiOutputError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

function classifyAiError(err: unknown): FailureClassification {
  if (err instanceof TranscriptError) return { message: err.message, permanent: err.permanent };
  if (err instanceof AiOutputError) return { message: err.message, permanent: true };
  const raw = err instanceof Error ? err.message : String(err);
  if (/\b402\b|credit/i.test(raw)) {
    return {
      message: "AI credits exhausted on the workspace. Add credits to keep processing jobs.",
      permanent: true,
    };
  }
  if (/\b429\b|rate limit/i.test(raw)) {
    return {
      message: "AI gateway is rate-limited right now. The job will retry automatically.",
      permanent: false,
    };
  }
  if (/abort|timed out|timeout/i.test(raw)) {
    return { message: "Generation took too long. The job will retry automatically.", permanent: false };
  }
  return { message: raw, permanent: false };
}

/**
 * Processes a single claimed job end-to-end. Caller MUST have already claimed
 * the job via `claim_jobs`. On error, this function records the failure via
 * `fail_job` (retry with backoff) or `fail_job_permanent` (terminal — input
 * cannot succeed on retry).
 */
export async function processClaimedJob(jobId: string, userId: string, attempt: number): Promise<void> {
  const started = Date.now();
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await supabaseAdmin.rpc("fail_job_permanent", {
      p_job_id: jobId,
      p_error: "Server is not configured for AI processing.",
    });
    return;
  }

  try {
    // `claim_jobs` already returned the authoritative user_id; we only need
    // the job's source fields here.
    const { data: job, error: readErr } = await supabaseAdmin
      .from("content_jobs")
      .select("user_id,source_type,source_url,transcript,title")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();
    // Ownership mismatch / missing row is PERMANENT — retrying can't fix it.
    if (readErr) throw new AiOutputError("Failed to read job.");
    if (!job) throw new AiOutputError("Job not found or ownership mismatch.");

    // Mirror status on the user-facing row. Surface failures — if this row
    // can't be updated we shouldn't quietly continue with stale UI.
    const { error: statusErr } = await supabaseAdmin
      .from("content_jobs")
      .update({ status: "processing", error_message: null })
      .eq("id", jobId)
      .eq("user_id", userId);
    if (statusErr) throw new AiOutputError("Failed to set processing status.");

    log("claim", jobId, { attempt });

    let transcript = job.transcript ?? "";
    let provider: "youtube" | "pasted" = "pasted";
    if (job.source_type === "youtube") {
      const tStart = Date.now();
      const r = await fetchTranscript(
        { source_type: job.source_type, source_url: job.source_url, transcript: job.transcript },
        { youtubeTimeoutMs: YOUTUBE_TIMEOUT_MS },
      );
      transcript = r.text;
      provider = r.provider;
      log("transcript", jobId, { ms: Date.now() - tStart, chars: transcript.length, provider });
    }
    if (!transcript || transcript.length < 50) {
      throw new TranscriptError("too_short", "Transcript is too short or unavailable.");
    }

    const truncated = transcript.length > MAX_TRANSCRIPT_CHARS;
    const capped = truncated ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) : transcript;
    if (truncated) {
      log("transcript", jobId, { truncatedFrom: transcript.length, to: MAX_TRANSCRIPT_CHARS });
    }
    if (provider !== "pasted") {
      await supabaseAdmin
        .from("content_jobs")
        .update({ transcript: capped, transcript_truncated: truncated })
        .eq("id", jobId)
        .eq("user_id", userId);
    } else if (truncated) {
      await supabaseAdmin
        .from("content_jobs")
        .update({ transcript_truncated: true })
        .eq("id", jobId)
        .eq("user_id", userId);
    }
    

    // Per Lovable AI Gateway docs: do NOT memoize the provider — the run-id
    // closure is per-request. One instance per job is correct.
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const aiStart = Date.now();
    let out: z.infer<typeof OutputSchema>;
    try {
      const result = await generateText({
        model,
        experimental_output: Output.object({ schema: OutputSchema }),
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
        prompt: `${PROMPT_PREAMBLE}\n\nTRANSCRIPT:\n"""\n${capped}\n"""`,
      });
      if (!result.experimental_output) {
        throw new AiOutputError("AI returned no structured output. The job will retry.");
      }
      out = result.experimental_output;
    } catch (err) {
      // Zod / schema validation errors are permanent — the same broken JSON
      // will fail again. Pure parse/network truncation errors stay retryable.
      // Static client message; raw provider text is logged server-side only.
      const raw = err instanceof Error ? err.message : String(err);
      if (/schema|zod|invalid_type|output validation/i.test(raw)) {
        console.error(JSON.stringify({ scope: "ai.schema", jobId, raw: raw.slice(0, 500) }));
        throw new AiOutputError("AI returned invalid structured output.");
      }
      throw err;
    }
    log("ai", jobId, { ms: Date.now() - aiStart, runId: gateway.getRunId() });

    // Honour user-supplied title if they provided one (not the default "Untitled").
    const finalTitle = job.title && job.title !== "Untitled" ? job.title : out.title;

    const { error: persistErr } = await supabaseAdmin
      .from("content_jobs")
      .update({
        status: "done",
        title: finalTitle,
        blog_post: out.blog_post,
        linkedin_carousel: out.linkedin_carousel,
        email_newsletter: out.email_newsletter,
        twitter_threads: out.twitter_threads,
        aig_run_id: gateway.getRunId() ?? null,
        error_message: null,
      })
      .eq("id", jobId)
      .eq("user_id", userId);
    if (persistErr) throw new Error("Failed to persist generated assets");

    // Mark queue done + charge characters in one transactional RPC so a
    // worker death between the two can't leave a completed job uncharged.
    await supabaseAdmin.rpc("complete_job_and_charge", {
      p_job_id: jobId,
      p_user: userId,
      p_delta: capped.length,
    });

    log("persist", jobId, { totalMs: Date.now() - started });
  } catch (err) {
    const { message, permanent } = classifyAiError(err);
    console.error(
      JSON.stringify({ scope: "processJob", phase: "error", jobId, attempt, permanent, msg: message }),
    );
    if (permanent) {
      await supabaseAdmin.rpc("fail_job_permanent", { p_job_id: jobId, p_error: message });
    } else {
      await supabaseAdmin.rpc("fail_job", { p_job_id: jobId, p_error: message });
    }
  }
}

/**
 * Drains up to `limit` queued jobs in parallel. Called by the cron hook.
 * Parallelism matters: with 3 sequential jobs at ~22 s each we'd exceed the
 * Worker request budget. `Promise.allSettled` keeps one failure from sinking
 * the others.
 */
export async function drainQueue(limit = 2): Promise<{ processed: number; skipped?: boolean }> {
  // Single-flight: if another tick is already draining, bail out fast so we
  // don't stack concurrent Worker invocations against the same backlog.
  // claim_jobs already uses SKIP LOCKED at the row level, but the advisory
  // lock prevents the AI-call fan-out from doubling up.
  const { data: gotLock, error: lockErr } = await supabaseAdmin.rpc("try_acquire_drain_lock");
  if (lockErr) throw lockErr;
  if (!gotLock) {
    console.log(JSON.stringify({ scope: "drainQueue", msg: "skipped — another drain in flight" }));
    return { processed: 0, skipped: true };
  }

  const { data: claims, error } = await supabaseAdmin.rpc("claim_jobs", {
    p_limit: limit,
    p_lock_seconds: 60,
  });
  if (error) throw error;
  const rows = (claims ?? []) as Array<{ job_id: string; user_id: string; attempts: number }>;
  const results = await Promise.allSettled(
    rows.map((c) => processClaimedJob(c.job_id, c.user_id, c.attempts)),
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error(
        JSON.stringify({
          scope: "drainQueue",
          msg: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }),
      );
    }
  }
  return { processed: rows.length };
}
