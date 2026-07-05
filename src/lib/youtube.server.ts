import { YoutubeTranscript } from "youtube-transcript";

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function assertYouTubeUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only https:// YouTube URLs are supported");
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Only YouTube URLs are supported");
  }
  return parsed.toString();
}

export async function fetchYouTubeTranscript(url: string, timeoutMs = 25_000): Promise<string> {
  const safe = assertYouTubeUrl(url);
  // The underlying lib has no AbortSignal; this Promise.race bounds OUR wait
  // but leaks the underlying fetch handle until it eventually settles. Acceptable
  // because the lib uses a short upstream timeout itself.
  const items = await Promise.race([
    YoutubeTranscript.fetchTranscript(safe),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("YouTube transcript fetch timed out")), timeoutMs),
    ),
  ]);
  return items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
}
