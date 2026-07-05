
-- ============ Queue ============
CREATE TABLE public.jobs_queue (
  job_id uuid PRIMARY KEY REFERENCES public.content_jobs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.jobs_queue TO service_role;
ALTER TABLE public.jobs_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX jobs_queue_drain_idx
  ON public.jobs_queue (created_at)
  WHERE status IN ('queued','running');

CREATE TRIGGER jobs_queue_set_updated
BEFORE UPDATE ON public.jobs_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-enqueue every new content_job
CREATE OR REPLACE FUNCTION public.enqueue_content_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.jobs_queue (job_id) VALUES (NEW.id)
  ON CONFLICT (job_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER content_jobs_enqueue
AFTER INSERT ON public.content_jobs
FOR EACH ROW EXECUTE FUNCTION public.enqueue_content_job();

-- ============ Queue RPCs ============
CREATE OR REPLACE FUNCTION public.claim_jobs(p_limit int DEFAULT 3, p_lock_seconds int DEFAULT 60)
RETURNS TABLE(job_id uuid, user_id uuid, attempts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.job_id
    FROM public.jobs_queue q
    WHERE q.status = 'queued'
       OR (q.status = 'running' AND q.locked_until < now() AND q.attempts < q.max_attempts)
    ORDER BY q.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.jobs_queue q
    SET status = 'running',
        attempts = q.attempts + 1,
        locked_until = now() + make_interval(secs => p_lock_seconds)
    FROM candidates c
    WHERE q.job_id = c.job_id
    RETURNING q.job_id, q.attempts
  )
  SELECT u.job_id, cj.user_id, u.attempts
  FROM updated u JOIN public.content_jobs cj ON cj.id = u.job_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.jobs_queue
  SET status = 'done', locked_until = NULL
  WHERE job_id = p_job_id;
$$;

CREATE OR REPLACE FUNCTION public.fail_job(p_job_id uuid, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attempts int;
  v_max int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM public.jobs_queue WHERE job_id = p_job_id;

  IF v_attempts IS NULL THEN RETURN; END IF;

  IF v_attempts >= v_max THEN
    UPDATE public.jobs_queue
    SET status = 'failed', last_error = p_error, locked_until = NULL
    WHERE job_id = p_job_id;
    UPDATE public.content_jobs
    SET status = 'error', error_message = p_error
    WHERE id = p_job_id;
  ELSE
    UPDATE public.jobs_queue
    SET status = 'queued',
        last_error = p_error,
        locked_until = now() + make_interval(secs => (15 * power(2, v_attempts))::int)
    WHERE job_id = p_job_id;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.claim_jobs(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_job(uuid, text) TO service_role;

-- ============ Quotas + rate limit ============
CREATE TABLE public.usage_monthly (
  user_id uuid NOT NULL,
  year_month text NOT NULL,
  jobs_count int NOT NULL DEFAULT 0,
  characters_processed bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year_month)
);
GRANT SELECT ON public.usage_monthly TO authenticated;
GRANT ALL ON public.usage_monthly TO service_role;
ALTER TABLE public.usage_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own usage" ON public.usage_monthly
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.rate_limits (
  user_id uuid NOT NULL,
  bucket timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_quota_and_rate_limit(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');
  v_jobs int;
  v_minute timestamptz := date_trunc('minute', now());
  v_minute_count int;
  v_monthly_cap int := 10;
  v_rate_cap int := 5;
BEGIN
  SELECT COALESCE(jobs_count, 0) INTO v_jobs
  FROM public.usage_monthly WHERE user_id = p_user AND year_month = v_month;
  IF COALESCE(v_jobs, 0) >= v_monthly_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_quota_exceeded',
      'used', COALESCE(v_jobs,0), 'cap', v_monthly_cap);
  END IF;

  SELECT COALESCE(count, 0) INTO v_minute_count
  FROM public.rate_limits WHERE user_id = p_user AND bucket = v_minute;
  IF COALESCE(v_minute_count, 0) >= v_rate_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'cap', v_rate_cap, 'window', 'minute');
  END IF;

  INSERT INTO public.rate_limits(user_id, bucket, count) VALUES (p_user, v_minute, 1)
    ON CONFLICT (user_id, bucket) DO UPDATE SET count = public.rate_limits.count + 1;

  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, updated_at)
    VALUES (p_user, v_month, 1, now())
    ON CONFLICT (user_id, year_month) DO UPDATE
    SET jobs_count = public.usage_monthly.jobs_count + 1, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'used', COALESCE(v_jobs,0) + 1, 'cap', v_monthly_cap);
END $$;

GRANT EXECUTE ON FUNCTION public.check_quota_and_rate_limit(uuid) TO service_role;

-- Daily cleanup of old rate-limit buckets to keep the table tiny
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.rate_limits WHERE bucket < now() - interval '1 day';
$$;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;

-- ============ content_jobs additions ============
ALTER TABLE public.content_jobs ADD COLUMN aig_run_id text;

CREATE POLICY "Users delete own jobs" ON public.content_jobs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
