-- 1) Truncation flag
ALTER TABLE public.content_jobs
  ADD COLUMN IF NOT EXISTS transcript_truncated boolean NOT NULL DEFAULT false;

-- 2) Atomic increment for usage characters
CREATE OR REPLACE FUNCTION public.increment_usage_chars(p_user uuid, p_delta bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, characters_processed, updated_at)
  VALUES (p_user, to_char(now(), 'YYYY-MM'), 0, GREATEST(p_delta, 0), now())
  ON CONFLICT (user_id, year_month) DO UPDATE
  SET characters_processed = public.usage_monthly.characters_processed + GREATEST(p_delta, 0),
      updated_at = now();
$$;

-- 3) Permanent failure: skip remaining retries
CREATE OR REPLACE FUNCTION public.fail_job_permanent(p_job_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs_queue
  SET status = 'failed', last_error = p_error, locked_until = NULL,
      attempts = max_attempts
  WHERE job_id = p_job_id;
  UPDATE public.content_jobs
  SET status = 'error', error_message = p_error
  WHERE id = p_job_id;
END $$;

-- 4) Hot-path indexes
CREATE INDEX IF NOT EXISTS jobs_queue_status_created_at_idx
  ON public.jobs_queue (status, created_at);
CREATE INDEX IF NOT EXISTS content_jobs_user_created_at_idx
  ON public.content_jobs (user_id, created_at DESC);