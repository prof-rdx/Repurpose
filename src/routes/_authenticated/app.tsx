import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createContentJob, getUsage } from "@/lib/content.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Youtube, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "New repurpose — Repurpose" }] }),
  component: NewJob,
  errorComponent: NewJobError,
});

function NewJobError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="font-display text-2xl mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6">We couldn't load this page. Try again in a moment.</p>
      <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
    </main>
  );
}

function NewJob() {
  const router = useRouter();
  const qc = useQueryClient();
  const createJob = useServerFn(createContentJob);
  const usageFn = useServerFn(getUsage);
  const [tab, setTab] = useState<"youtube" | "transcript">("youtube");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: usage } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageFn(),
    staleTime: 60_000,
  });
  const atCap = usage && usage.jobs_count >= usage.monthly_cap;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading("Submitting…");
    try {
      const res = await createJob({
        data: {
          sourceType: tab,
          sourceUrl: tab === "youtube" ? url : undefined,
          transcript: tab === "transcript" ? transcript : undefined,
          title: title || undefined,
        },
      });
      toast.success("Generating your assets — opening the job…", { id: toastId });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
      router.navigate({ to: "/jobs/$id", params: { id: res.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start";
      toast.error(msg, { id: toastId });
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 animate-fade-up">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">New repurpose</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Drop a YouTube link or paste a transcript. We'll handle the rest.
        </p>
      </header>

      {atCap && (
        <div role="alert" className="animate-fade-up mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          You've used your monthly cap of {usage?.monthly_cap} jobs. It resets on the 1st.
        </div>
      )}

      <form onSubmit={submit} className="animate-fade-up stagger-1 space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-elegant sm:p-6" aria-busy={submitting}>

        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="title" placeholder="e.g. Q3 product webinar" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "youtube" | "transcript")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="youtube" className="min-h-10"><Youtube className="mr-2 h-4 w-4" aria-hidden="true" />YouTube URL</TabsTrigger>
            <TabsTrigger value="transcript" className="min-h-10"><FileText className="mr-2 h-4 w-4" aria-hidden="true" />Paste transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="youtube" className="mt-4 space-y-1.5">
            <Label htmlFor="url">YouTube URL</Label>
            <Input id="url" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => setUrl(e.target.value)} required={tab === "youtube"} aria-describedby="url-hint" />
            <p id="url-hint" className="text-xs text-muted-foreground">Works on any public video with captions. Up to 1 hour recommended.</p>
          </TabsContent>
          <TabsContent value="transcript" className="mt-4 space-y-1.5">
            <Label htmlFor="transcript">Transcript</Label>
            <Textarea id="transcript" rows={10} placeholder="Paste your transcript here…" value={transcript} onChange={(e) => setTranscript(e.target.value)} required={tab === "transcript"} aria-describedby="transcript-hint" />
            <p id="transcript-hint" className="text-xs text-muted-foreground">Minimum 50 characters. Up to ~30k characters processed.</p>
          </TabsContent>
        </Tabs>

        <Button type="submit" size="lg" className="group w-full min-h-12 gap-2 shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]" disabled={submitting || atCap}>
          <Sparkles className={"h-4 w-4 " + (submitting ? "animate-spin" : "transition-transform group-hover:rotate-12")} aria-hidden="true" />
          {submitting ? "Starting…" : "Generate all four assets"}
        </Button>

        {usage && (
          <p className="text-center text-xs text-muted-foreground">
            {usage.monthly_cap - usage.jobs_count} jobs left this month
          </p>
        )}
      </form>
    </main>
  );
}
