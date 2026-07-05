
CREATE OR REPLACE FUNCTION public.submit_content_job(
  p_user uuid,
  p_title text,
  p_source_type text,
  p_source_url text,
  p_transcript text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');
  v_jobs int;
  v_minute timestamptz := date_trunc('minute', now());
  v_minute_count int;
  v_monthly_cap int := 10;
  v_rate_cap int := 5;
  v_job_id uuid;
BEGIN
  -- Quota
  SELECT COALESCE(jobs_count, 0) INTO v_jobs
  FROM public.usage_monthly WHERE user_id = p_user AND year_month = v_month;
  IF COALESCE(v_jobs, 0) >= v_monthly_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_quota_exceeded',
      'used', COALESCE(v_jobs,0), 'cap', v_monthly_cap);
  END IF;

  -- Rate limit
  SELECT COALESCE(count, 0) INTO v_minute_count
  FROM public.rate_limits WHERE user_id = p_user AND bucket = v_minute;
  IF COALESCE(v_minute_count, 0) >= v_rate_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'cap', v_rate_cap, 'window', 'minute');
  END IF;

  -- Insert job FIRST so a failure (constraint, etc.) doesn't charge quota.
  INSERT INTO public.content_jobs(user_id, title, source_type, source_url, transcript, status)
  VALUES (p_user, COALESCE(NULLIF(btrim(p_title), ''), 'Untitled'),
          p_source_type, p_source_url,
          CASE WHEN p_source_type = 'transcript' THEN p_transcript ELSE NULL END,
          'pending')
  RETURNING id INTO v_job_id;

  -- Charge after successful insert.
  INSERT INTO public.rate_limits(user_id, bucket, count) VALUES (p_user, v_minute, 1)
    ON CONFLICT (user_id, bucket) DO UPDATE SET count = public.rate_limits.count + 1;

  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, updated_at)
    VALUES (p_user, v_month, 1, now())
    ON CONFLICT (user_id, year_month) DO UPDATE
    SET jobs_count = public.usage_monthly.jobs_count + 1, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id,
    'used', COALESCE(v_jobs,0) + 1, 'cap', v_monthly_cap);
END $$;
