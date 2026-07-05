-- Auto-maintain updated_at on content_jobs
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_jobs_set_updated_at ON public.content_jobs;
CREATE TRIGGER content_jobs_set_updated_at
BEFORE UPDATE ON public.content_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index to find pending jobs quickly for the background worker
CREATE INDEX IF NOT EXISTS content_jobs_pending_idx
  ON public.content_jobs(status, created_at)
  WHERE status IN ('pending','processing');