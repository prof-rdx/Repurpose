
-- 1) submit_content_job: derive user from auth.uid(), drop p_user
DROP FUNCTION IF EXISTS public.submit_content_job(uuid, text, text, text, text);
CREATE OR REPLACE FUNCTION public.submit_content_job(
  p_title text,
  p_source_type text,
  p_source_url text,
  p_transcript text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_month text := to_char(now(), 'YYYY-MM');
  v_jobs int;
  v_minute timestamptz := date_trunc('minute', now());
  v_minute_count int;
  v_monthly_cap int := 10;
  v_rate_cap int := 5;
  v_job_id uuid;
  v_url text := NULLIF(btrim(COALESCE(p_source_url, '')), '');
  v_transcript text := NULLIF(p_transcript, '');
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_source_type NOT IN ('youtube','transcript') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_source_type');
  END IF;

  SELECT COALESCE(jobs_count, 0) INTO v_jobs
  FROM public.usage_monthly WHERE user_id = v_user AND year_month = v_month;
  IF COALESCE(v_jobs, 0) >= v_monthly_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_quota_exceeded',
      'used', COALESCE(v_jobs,0), 'cap', v_monthly_cap);
  END IF;

  SELECT COALESCE(count, 0) INTO v_minute_count
  FROM public.rate_limits WHERE user_id = v_user AND bucket = v_minute;
  IF COALESCE(v_minute_count, 0) >= v_rate_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'cap', v_rate_cap, 'window', 'minute');
  END IF;

  INSERT INTO public.content_jobs(user_id, title, source_type, source_url, transcript, status)
  VALUES (v_user, COALESCE(NULLIF(btrim(COALESCE(p_title, '')), ''), 'Untitled'),
          p_source_type, v_url,
          CASE WHEN p_source_type = 'transcript' THEN v_transcript ELSE NULL END,
          'pending')
  RETURNING id INTO v_job_id;

  INSERT INTO public.rate_limits(user_id, bucket, count) VALUES (v_user, v_minute, 1)
    ON CONFLICT (user_id, bucket) DO UPDATE SET count = public.rate_limits.count + 1;

  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, updated_at)
    VALUES (v_user, v_month, 1, now())
    ON CONFLICT (user_id, year_month) DO UPDATE
    SET jobs_count = public.usage_monthly.jobs_count + 1, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id,
    'used', COALESCE(v_jobs,0) + 1, 'cap', v_monthly_cap);
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_content_job(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_content_job(text, text, text, text) TO authenticated;

-- 2) check_quota_and_rate_limit: identity from auth.uid()
DROP FUNCTION IF EXISTS public.check_quota_and_rate_limit(uuid);
CREATE OR REPLACE FUNCTION public.check_quota_and_rate_limit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_month text := to_char(now(), 'YYYY-MM');
  v_jobs int;
  v_minute timestamptz := date_trunc('minute', now());
  v_minute_count int;
  v_monthly_cap int := 10;
  v_rate_cap int := 5;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT COALESCE(jobs_count, 0) INTO v_jobs
  FROM public.usage_monthly WHERE user_id = v_user AND year_month = v_month;
  IF COALESCE(v_jobs, 0) >= v_monthly_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_quota_exceeded',
      'used', COALESCE(v_jobs,0), 'cap', v_monthly_cap);
  END IF;

  SELECT COALESCE(count, 0) INTO v_minute_count
  FROM public.rate_limits WHERE user_id = v_user AND bucket = v_minute;
  IF COALESCE(v_minute_count, 0) >= v_rate_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'cap', v_rate_cap, 'window', 'minute');
  END IF;

  INSERT INTO public.rate_limits(user_id, bucket, count) VALUES (v_user, v_minute, 1)
    ON CONFLICT (user_id, bucket) DO UPDATE SET count = public.rate_limits.count + 1;

  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, updated_at)
    VALUES (v_user, v_month, 1, now())
    ON CONFLICT (user_id, year_month) DO UPDATE
    SET jobs_count = public.usage_monthly.jobs_count + 1, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'used', COALESCE(v_jobs,0) + 1, 'cap', v_monthly_cap);
END $$;

REVOKE EXECUTE ON FUNCTION public.check_quota_and_rate_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_quota_and_rate_limit() TO authenticated;

-- 3) Worker/queue-only fns: revoke from anon/authenticated, grant to service_role
REVOKE EXECUTE ON FUNCTION public.claim_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_jobs(integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_job(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fail_job(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_job_permanent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fail_job_permanent(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.try_acquire_drain_lock() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.try_acquire_drain_lock() TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_usage_chars(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_usage_chars(uuid, bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decrement_quota(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;

-- 4) complete_job_and_charge: also flip content_jobs.status atomically
CREATE OR REPLACE FUNCTION public.complete_job_and_charge(p_job_id uuid, p_user uuid, p_delta bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.jobs_queue
  SET status = 'done', locked_until = NULL
  WHERE job_id = p_job_id;

  -- Belt-and-braces: ensure the user-visible row reflects completion even if
  -- the worker's prior UPDATE was lost. Only flips from non-terminal states.
  UPDATE public.content_jobs
  SET status = 'done', error_message = NULL
  WHERE id = p_job_id
    AND user_id = p_user
    AND status NOT IN ('done','error');

  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, characters_processed, updated_at)
  VALUES (p_user, to_char(now(), 'YYYY-MM'), 0, GREATEST(p_delta, 0), now())
  ON CONFLICT (user_id, year_month) DO UPDATE
  SET characters_processed = public.usage_monthly.characters_processed + GREATEST(p_delta, 0),
      updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.complete_job_and_charge(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_job_and_charge(uuid, uuid, bigint) TO service_role;

-- 5) RLS-locked tables: document the design so the linter "no policies" INFO is explainable.
COMMENT ON TABLE public.rate_limits IS
  'Write/read only via SECURITY DEFINER RPCs (submit_content_job, check_quota_and_rate_limit, cleanup_rate_limits). RLS enabled with no policies is intentional.';
COMMENT ON TABLE public.jobs_queue IS
  'Worker-only queue. All access via SECURITY DEFINER RPCs (claim_jobs, complete_job_*, fail_job_*) running as service_role.';
