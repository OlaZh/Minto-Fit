-- Apply this in the Supabase SQL editor before using the new ProgramEdit save flow.

create or replace function public.mf_save_program_atomic(
  p_program_id uuid default null,
  p_name text default null,
  p_type text default null,
  p_color text default null,
  p_has_cardio boolean default true,
  p_has_cardio_finish boolean default false,
  p_activity_type text default 'силове',
  p_exercises jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_program_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'PROGRAM_NAME_REQUIRED';
  end if;

  if coalesce(btrim(p_type), '') = '' then
    raise exception 'PROGRAM_TYPE_REQUIRED';
  end if;

  if coalesce(btrim(p_activity_type), '') = '' then
    raise exception 'ACTIVITY_TYPE_REQUIRED';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'EXERCISES_PAYLOAD_MUST_BE_ARRAY';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_exercises) as payload(exercise)
    where nullif(payload.exercise ->> 'exercise_id', '') is null
  ) then
    raise exception 'EXERCISE_ID_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_exercises) as payload(exercise)
    left join public.mf_exercises e
      on e.id = (payload.exercise ->> 'exercise_id')::uuid
     and e.user_id = v_user_id
    where e.id is null
  ) then
    raise exception 'EXERCISE_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if p_program_id is null then
    insert into public.mf_programs (
      user_id,
      name,
      type,
      color,
      has_cardio,
      has_cardio_finish,
      activity_type
    )
    values (
      v_user_id,
      btrim(p_name),
      btrim(p_type),
      p_color,
      coalesce(p_has_cardio, true),
      coalesce(p_has_cardio_finish, false),
      btrim(p_activity_type)
    )
    returning id into v_program_id;
  else
    update public.mf_programs
    set
      name = btrim(p_name),
      type = btrim(p_type),
      color = p_color,
      has_cardio = coalesce(p_has_cardio, true),
      has_cardio_finish = coalesce(p_has_cardio_finish, false),
      activity_type = btrim(p_activity_type)
    where id = p_program_id
      and user_id = v_user_id
    returning id into v_program_id;

    if v_program_id is null then
      raise exception 'PROGRAM_NOT_FOUND_OR_FORBIDDEN';
    end if;
  end if;

  update public.mf_exercises e
  set
    description = nullif(btrim(payload.exercise ->> 'description'), ''),
    about = nullif(btrim(payload.exercise ->> 'about'), ''),
    machine_photo_url = nullif(btrim(payload.exercise ->> 'photo_url'), '')
  from jsonb_array_elements(p_exercises) as payload(exercise)
  where e.id = (payload.exercise ->> 'exercise_id')::uuid
    and e.user_id = v_user_id;

  delete from public.mf_program_exercises
  where program_id = v_program_id;

  insert into public.mf_program_exercises (
    program_id,
    exercise_id,
    "order",
    default_sets,
    default_reps,
    default_weight,
    default_duration,
    exercise_mode,
    tracks_weight
  )
  select
    v_program_id,
    (payload.exercise ->> 'exercise_id')::uuid,
    payload.ordinality::integer,
    coalesce((payload.exercise ->> 'sets')::integer, 3),
    case
      when coalesce(payload.exercise ->> 'mode', 'reps') = 'time' then 0
      else coalesce((payload.exercise ->> 'reps')::integer, 10)
    end,
    case
      when coalesce((payload.exercise ->> 'tracks_weight')::boolean, true)
        then coalesce((payload.exercise ->> 'weight')::numeric(6,2), 0)
      else 0
    end,
    case
      when coalesce(payload.exercise ->> 'mode', 'reps') = 'time'
        then coalesce((payload.exercise ->> 'duration')::integer, 0)
      else 0
    end,
    case
      when coalesce(payload.exercise ->> 'mode', 'reps') = 'time' then 'time'
      else 'reps'
    end,
    coalesce((payload.exercise ->> 'tracks_weight')::boolean, true)
  from jsonb_array_elements(p_exercises) with ordinality as payload(exercise, ordinality);

  return v_program_id;
end;
$$;

grant execute on function public.mf_save_program_atomic(uuid, text, text, text, boolean, boolean, text, jsonb) to authenticated;
