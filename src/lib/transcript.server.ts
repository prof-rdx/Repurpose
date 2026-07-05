/**
 * Transcript provider abstraction.
 *
 * Today the only public source is `youtube` (scrapes captions via
 * `youtube-transcript`). The pasted-transcript path is also handled here.
 *
 * An `audio_url` STT provider previously lived here but was removed: it has
 * no UI surface today and the SSRF / size-bypass risks of fetching arbitrary
 * URLs from the worker aren't worth carrying. To bring it back, add a strict
 * host allow-list, a streaming-size enforcement reader, and re-add the
 * `audio_url` branch to `fetchTranscript` plus the `CreateInput` enum in
 * `content.functions.ts`.
 */
import { fetchYouTubeTranscript } from "./youtube.server";

export type TranscriptErrorCode =
  | "no_captions"
  | "unavailable"
  | "rate_limited"
  | "timeout"
  | "too_short"
  | "invalid_source";

/** Codes for which retrying the same input cannot succeed. */
const PERMANENT_CODES: ReadonlySet<TranscriptErrorCode> = new Set([
  "no_captions",
  "too_short",
  "invalid_source",
]);

export class TranscriptError extends Error {
  readonly code: TranscriptErrorCode;
  readonly permanent: boolean;
  constructor(code: TranscriptErrorCode, message: string) {
    super(message);
    this.code = code;
    this.permanent = PERMANENT_CODES.has(code);
    this.name = "TranscriptError";
  }
}

function classifyYouTubeError(err: unknown): TranscriptError {
  const raw = err instanceof Error ? err.message : String(err);
  if (/transcript.*disabled|no transcript|could not find|captions? (are )?disabled/i.test(raw)) {
    return new TranscriptError(
      "no_captions",
      "This video has no public captions. Try another video or paste the transcript.",
    );
  }
  if (/timed out|timeout|abort/i.test(raw)) {
    return new TranscriptError("timeout", "Fetching the YouTube transcript took too long. The job will retry.");
  }
  if (/\b429\b|rate/i.test(raw)) {
    return new TranscriptError("rate_limited", "YouTube is rate-limiting transcript fetches. The job will retry.");
  }
  // Avoid leaking raw library internals to the client.
  console.error(JSON.stringify({ scope: "youtube.transcript", msg: raw.slice(0, 300) }));
  return new TranscriptError(
    "unavailable",
    "Could not fetch the YouTube transcript. Try another video or paste the transcript.",
  );
}

async function fetchYouTube(url: string, timeoutMs: number): Promise<string> {
  try {
    return await fetchYouTubeTranscript(url, timeoutMs);
  } catch (err) {
    throw classifyYouTubeError(err);
  }
}

export interface TranscriptJob {
  source_type: string;
  source_url: string | null;
  transcript: string | null;
}

export interface TranscriptResult {
  text: string;
  provider: "youtube" | "pasted";
}

export async function fetchTranscript(
  job: TranscriptJob,
  opts: { youtubeTimeoutMs?: number },
): Promise<TranscriptResult> {
  if (job.source_type === "youtube") {
    if (!job.source_url) throw new TranscriptError("invalid_source", "Missing YouTube URL.");
    const text = await fetchYouTube(job.source_url, opts.youtubeTimeoutMs ?? 15_000);
    return { text, provider: "youtube" };
  }
  // Pasted-transcript path: transcript is already stored on the row.
  const text = (job.transcript ?? "").trim();
  if (!text) throw new TranscriptError("too_short", "No transcript was provided.");
  return { text, provider: "pasted" };
}
