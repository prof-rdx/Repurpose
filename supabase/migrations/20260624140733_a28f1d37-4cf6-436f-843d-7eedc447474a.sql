CREATE OR REPLACE FUNCTION public.complete_job_and_charge(p_job_id uuid, p_user uuid, p_delta bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs_queue
  SET status = 'done', locked_until = NULL
  WHERE job_id = p_job_id;

  INSERT INTO public.usage_monthly(user_id, year_month, jobs_count, characters_processed, updated_at)
  VALUES (p_user, to_char(now(), 'YYYY-MM'), 0, GREATEST(p_delta, 0), now())
  ON CONFLICT (user_id, year_month) DO UPDATE
  SET characters_processed = public.usage_monthly.characters_processed + GREATEST(p_delta, 0),
      updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.complete_job_and_charge(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job_and_charge(uuid, uuid, bigint) TO service_role;