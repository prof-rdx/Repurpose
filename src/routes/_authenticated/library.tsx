import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLibrary,
  deleteContentJob,
  getActiveJobStatuses,
} from "@/lib/content.functions";
import { useTabHidden } from "@/hooks/use-tab-hidden";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, FileText, Youtube } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library — Repurpose" }] }),
  component: Library,
  errorComponent: LibraryError,
});

function LibraryError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="mb-2 font-display text-2xl">Couldn't load your library</h2>
      <p className="mb-6 text-sm text-muted-foreground">Something went wrong loading your jobs.</p>
      <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
    </main>
  );
}

const STATUS_STYLE: Record<string, string> = {
  done: "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30",
  processing: "bg-primary/20 text-primary-foreground ring-1 ring-inset ring-primary/40 animate-pulse",
  pending: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  error: "bg-destructive/20 text-destructive-foreground ring-1 ring-inset ring-destructive/40",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[status] ?? "bg-muted text-muted-foreground")}>
      <span className="sr-only">Status: </span>
      {status}
    </span>
  );
}

type JobRow = {
  id: string;
  title: string;
  status: string;
  source_type: string;
  source_url: string | null;
  created_at: string;
  error_message: string | null;
};

function Library() {
  const fetchLibrary = useServerFn(getLibrary);
  const fetchActive = useServerFn(getActiveJobStatuses);
  const removeJob = useServerFn(deleteContentJob);
  const qc = useQueryClient();
  const hidden = useTabHidden();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["library"],
    queryFn: ({ pageParam }) =>
      fetchLibrary({ data: pageParam ? { cursor: pageParam } : undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.rows.length > 0
        ? (last.rows[last.rows.length - 1] as JobRow).created_at
        : undefined,
    staleTime: 15_000,
  });

  const rows = (data?.pages.flatMap((p) => p.rows) ?? []) as JobRow[];
  const usage = data?.pages[0]?.usage;
  const hasActive = rows.some((r) => r.status === "pending" || r.status === "processing");

  // Slim poll — patch statuses in place; only invalidate when a job terminates
  // (done/error) so the full library + usage refresh.
  useQuery({
    queryKey: ["active-job-statuses"],
    queryFn: async () => {
      const res = await fetchActive();
      const map = new Map(res.rows.map((r) => [r.id, r.status]));
      const prev = qc.getQueryData<{
        pages: Array<{ rows: JobRow[]; hasMore: boolean; usage: unknown }>;
        pageParams: unknown[];
      }>(["library"]);
      if (!prev) return res;
      let terminated = false;
      const nextPages = prev.pages.map((page) => ({
        ...page,
        rows: page.rows.map((row) => {
          if (row.status !== "pending" && row.status !== "processing") return row;
          const next = map.get(row.id) ?? "done";
          if (next === row.status) return row;
          if (next === "done" || next === "error") terminated = true;
          return { ...row, status: next };
        }),
      }));
      qc.setQueryData(["library"], { ...prev, pages: nextPages });
      if (terminated) {
        // Refresh full payload (assets, usage, error_message) for the first page only.
        qc.invalidateQueries({ queryKey: ["library"], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["usage"] });
      }
      return res;
    },
    enabled: hasActive && !hidden,
    refetchInterval: 4000,
    refetchOnWindowFocus: false,
    staleTime: 3500,
  });

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await removeJob({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  const usagePct = usage ? Math.min(100, (usage.jobs_count / usage.monthly_cap) * 100) : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl">Library</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Every piece you've repurposed.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {usage && (
            <div className="hidden text-right text-xs text-muted-foreground sm:block" aria-label={`${usage.jobs_count} of ${usage.monthly_cap} jobs used this month`}>
              <div>{usage.jobs_count} / {usage.monthly_cap} jobs this month</div>
              <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={usage.monthly_cap} aria-valuenow={usage.jobs_count}>
                <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${usagePct}%` }} />
              </div>
            </div>
          )}
          <Link to="/app">
            <Button className="min-h-11 gap-2 shadow-glow">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>New</span>
            </Button>
          </Link>
        </div>
      </header>

      {usage && (
        <div className="mb-6 sm:hidden" aria-hidden="true">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{usage.jobs_count} / {usage.monthly_cap} jobs this month</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      )}

      {isLoading ? (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl border border-border/60 bg-card" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-12 text-center">
          <p className="mb-2 font-display text-xl">Nothing here yet</p>
          <p className="mb-4 text-sm text-muted-foreground">Drop your first video or transcript to get started.</p>
          <Link to="/app"><Button className="min-h-11 shadow-glow">Create your first</Button></Link>
        </div>
      ) : (
        <>
        <ul className="space-y-2">
          {rows.map((j, i) => {
            const isYT = j.source_type === "youtube";
            const when = new Date(j.created_at);
            const dateStr = when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            const delay = `${Math.min(i, 8) * 40}ms`;
            return (
              <li key={j.id} className="animate-fade-up" style={{ animationDelay: delay }}>
                <div className="group relative flex items-stretch gap-2 rounded-xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow">

                  <Link
                    to="/jobs/$id"
                    params={{ id: j.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true">
                      {isYT ? <Youtube className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{j.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <time dateTime={when.toISOString()}>{dateStr}</time>
                        <span aria-hidden="true"> · </span>
                        {isYT ? j.source_url : "Pasted transcript"}
                      </span>
                      {j.status === "error" && j.error_message && (
                        <span className="mt-1 block truncate text-xs text-destructive">{j.error_message}</span>
                      )}
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1 pr-3">
                    <StatusBadge status={j.status} />
                    <button
                      type="button"
                      aria-label={`Delete job: ${j.title}`}
                      onClick={() => setPendingDelete({ id: j.id, title: j.title })}
                      className="grid h-11 w-11 place-items-center rounded-md text-muted-foreground opacity-60 transition-all hover:bg-destructive/15 hover:text-destructive hover:opacity-100 focus-visible:bg-destructive/15 focus-visible:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {hasNextPage && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="min-h-11">
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
        </>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.title}" and its generated assets will be permanently removed.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
