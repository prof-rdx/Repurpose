import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getJobStatus, getJobAssets, deleteContentJob } from "@/lib/content.functions";
import { useTabHidden } from "@/hooks/use-tab-hidden";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Code-split the markdown stack — only loaded when a job is done.
const BlogMarkdown = lazy(() => import("@/components/blog-markdown"));
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Slide = { heading: string; body: string };

export const Route = createFileRoute("/_authenticated/jobs/$id")({
  head: () => ({ meta: [{ title: "Repurposed content" }] }),
  component: JobView,
  errorComponent: JobError,
});

function JobError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="mb-2 font-display text-2xl">Couldn't load this job</h2>
      <p className="mb-6 text-sm text-muted-foreground">Something went wrong loading the generated assets.</p>
      <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
    </main>
  );
}

async function copy(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers / insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy");
  }
}

function JobView() {
  const { id } = Route.useParams();
  const router = useRouter();
  const fetchStatus = useServerFn(getJobStatus);
  const fetchAssets = useServerFn(getJobAssets);
  const removeJob = useServerFn(deleteContentJob);
  const hidden = useTabHidden();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const tickCount = useRef(0);
  // Reset polling backoff when navigating between jobs (the route component
  // is reused across param changes).
  useEffect(() => {
    tickCount.current = 0;
  }, [id]);
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["job-status", id],
    queryFn: () => fetchStatus({ data: { id } }),
    refetchInterval: (q) => {
      if (hidden) return false;
      const s = q.state.data?.status;
      if (s !== "pending" && s !== "processing") return false;
      tickCount.current += 1;
      if (tickCount.current <= 4) return 1500;
      if (tickCount.current <= 12) return 3000;
      return 5000;
    },
  });

  const { data: job } = useQuery({
    queryKey: ["job-assets", id],
    queryFn: () => fetchAssets({ data: { id } }),
    enabled: !!status && (status.status === "done" || status.status === "error"),
  });

  async function handleDelete() {
    setDeleteOpen(false);
    try {
      await removeJob({ data: { id } });
      toast.success("Job deleted");
      router.navigate({ to: "/library" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete job");
    }
  }

  // Distinguish loading (undefined) from confirmed not-found (null).
  if (statusLoading || status === undefined) return <JobSkeleton />;
  if (status === null) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground">Job not found.</p>
        <Link to="/library" className="mt-2 inline-block text-sm underline">Back to library</Link>
      </main>
    );
  }

  const isWorking = status.status === "pending" || status.status === "processing";

  // Defensive: the DB columns are jsonb, so older rows or manual edits could
  // contain a non-array. Coerce so the renderer never crashes.
  const slides: Slide[] = Array.isArray(job?.linkedin_carousel)
    ? (job!.linkedin_carousel as Slide[])
    : [];
  const threads: string[][] = Array.isArray(job?.twitter_threads)
    ? ((job!.twitter_threads as unknown[]).filter(Array.isArray) as string[][])
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Link
          to="/library"
          className="inline-flex min-h-9 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back to library
        </Link>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete this job"
            >
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this job?</AlertDialogTitle>
              <AlertDialogDescription>
                The generated blog post, carousel, newsletter and threads will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {job?.title ?? "Generating…"}
      </h1>
      {job && (
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {job.source_type === "youtube" ? job.source_url : "Pasted transcript"} · {new Date(job.created_at).toLocaleString()}
        </p>
      )}

      <div className="mt-8">
        {isWorking && (
          <div className="animate-fade-up relative overflow-hidden rounded-2xl border border-border/60 bg-card p-8 shadow-elegant sm:p-10">
            <div aria-hidden="true" className="shimmer pointer-events-none absolute inset-x-0 top-0 h-1" />
            <div className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary animate-pulse-ring">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              </span>
              <p className="font-display text-lg font-semibold sm:text-xl">
                {status.status === "pending" ? "Queued…" : "Generating your assets…"}
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This usually takes 20–40 seconds. We'll retry if it stalls.
            </p>
            <ol className="mt-6 space-y-2 text-sm" aria-label="Progress">
              {[
                // Real signals — no fake checkmarks before work has begun.
                { label: "Queued", done: true },
                { label: "Fetching transcript & analyzing", done: status.status === "processing" },
                { label: "Writing blog, carousel, email, threads", done: false },
              ].map((step, i) => (
                <li
                  key={i}
                  className="animate-fade-up flex items-center gap-3"
                  style={{ animationDelay: `${i * 90 + 120}ms` }}
                >
                  <span
                    className={
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-medium ring-1 ring-inset transition-colors " +
                      (step.done
                        ? "bg-primary/15 text-primary ring-primary/30"
                        : "bg-muted text-muted-foreground ring-border")
                    }
                    aria-hidden="true"
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                  <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
            <span className="sr-only" role="status">
              {status.status === "pending" ? "Job is queued" : "Generating assets"}
            </span>
          </div>
        )}


        {status.status === "error" && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
            <p className="font-medium text-destructive">Something went wrong</p>
            <p className="mt-1 text-sm">{status.error_message ?? job?.error_message ?? "Unknown error"}</p>
          </div>
        )}

        {status.status === "done" && job && (
          <Tabs defaultValue="blog">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
              <TabsList className="mb-6 inline-flex w-max min-w-full grid-cols-4 sm:grid">
                <TabsTrigger value="blog">Blog</TabsTrigger>
                <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="twitter">Twitter</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="blog">
              <Asset title="SEO blog post" onCopy={() => copy(job.blog_post ?? "")}>
                <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-accent prose-strong:text-foreground sm:text-[17px]">
                  <Suspense fallback={<div className="h-32 animate-pulse rounded bg-muted" />}>
                    <BlogMarkdown content={job.blog_post ?? ""} />
                  </Suspense>
                </article>
              </Asset>
            </TabsContent>

            <TabsContent value="linkedin">
              <Asset
                title="LinkedIn carousel (5 slides)"
                onCopy={() =>
                  copy(slides.map((s, i) => `Slide ${i + 1}: ${s.heading}\n${s.body}`).join("\n\n"))
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {slides.map((s, i, arr) => (
                    <div
                      key={i}
                      className="group relative flex aspect-square animate-fade-up flex-col overflow-hidden rounded-xl border border-primary/30 p-5 shadow-glow transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]"
                      style={{ background: "var(--gradient-primary)", animationDelay: `${i * 80}ms` }}
                    >
                      <div aria-hidden="true" className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: "radial-gradient(60% 60% at 30% 20%, rgba(255,255,255,0.18), transparent 70%)" }} />
                      <div className="relative mb-3 flex items-center justify-between text-xs font-medium text-primary-foreground/80">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-background/20 text-primary-foreground backdrop-blur">{i + 1}</span>
                        <span>{i + 1} / {arr.length}</span>
                      </div>
                      <div className="relative mb-2 font-display text-lg font-semibold leading-tight text-primary-foreground">{s.heading}</div>
                      <div className="relative flex-1 text-sm leading-relaxed text-primary-foreground/90">{s.body}</div>
                    </div>
                  ))}
                </div>

              </Asset>
            </TabsContent>

            <TabsContent value="email">
              <Asset title="Email newsletter" onCopy={() => copy(job.email_newsletter ?? "")}>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{job.email_newsletter}</pre>
              </Asset>
            </TabsContent>

            <TabsContent value="twitter">
              <div className="space-y-4">
                {threads.map((thread, i) => (
                  <Asset
                    key={i}
                    title={`Thread ${i + 1}`}
                    onCopy={() => copy(thread.join("\n\n"))}
                  >
                    <ol className="space-y-2">
                      {thread.map((tw, j) => (
                        <li key={j} className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                          <span className="mr-2 text-xs text-muted-foreground">{j + 1}/{thread.length}</span>
                          {tw}
                        </li>
                      ))}
                    </ol>
                  </Asset>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}

function JobSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6" aria-busy="true">
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mb-3 h-9 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mb-8 h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card" />
    </main>
  );
}

function Asset({ title, onCopy, children }: { title: string; onCopy: () => void; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border/60 bg-card p-5 shadow-elegant sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="truncate font-display text-lg font-semibold sm:text-xl">{title}</h2>
        <Button size="sm" variant="outline" onClick={onCopy} className="min-h-9 shrink-0" aria-label={`Copy ${title}`}>
          <Copy className="mr-1 h-4 w-4" aria-hidden="true" />Copy
        </Button>
      </div>
      {children}
    </section>
  );
}
