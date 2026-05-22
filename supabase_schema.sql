-- MintoFit — Schema
-- Запускати в Supabase SQL Editor одним блоком

-- ─────────────────────────────────────────
-- 1. mf_programs
-- ─────────────────────────────────────────
create table mf_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('основна', 'додаткова')),
  color       text,
  emoji       text,
  created_at  timestamptz not null default now()
);

alter table mf_programs enable row level security;
create policy "owner" on mf_programs
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 2. mf_exercises
-- ─────────────────────────────────────────
create table mf_exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  machine_photo_url text,
  youtube_url       text,
  muscle_group      text,
  personal_note     text,
  created_at        timestamptz not null default now()
);

alter table mf_exercises enable row level security;
create policy "owner" on mf_exercises
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 3. mf_program_exercises
-- ─────────────────────────────────────────
create table mf_program_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references mf_programs(id) on delete cascade,
  exercise_id     uuid not null references mf_exercises(id) on delete cascade,
  "order"         integer not null default 0,
  default_sets    integer not null default 3,
  default_reps    integer not null default 10,
  default_weight  numeric(6,2) not null default 0
);

alter table mf_program_exercises enable row level security;
create policy "owner" on mf_program_exercises
  using (
    exists (
      select 1 from mf_programs p
      where p.id = program_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mf_programs p
      where p.id = program_id and p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- 4. mf_alternative_exercises
-- ─────────────────────────────────────────
create table mf_alternative_exercises (
  id                      uuid primary key default gen_random_uuid(),
  exercise_id             uuid not null references mf_exercises(id) on delete cascade,
  alternative_exercise_id uuid not null references mf_exercises(id) on delete cascade,
  unique (exercise_id, alternative_exercise_id)
);

alter table mf_alternative_exercises enable row level security;
create policy "owner" on mf_alternative_exercises
  using (
    exists (
      select 1 from mf_exercises e
      where e.id = exercise_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mf_exercises e
      where e.id = exercise_id and e.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- 5. mf_workouts
-- ─────────────────────────────────────────
create table mf_workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  program_id        uuid references mf_programs(id) on delete set null,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  duration_minutes  integer,
  intensity         text check (intensity in ('важко', 'нормально', 'легко')),
  calories_burned   integer,
  created_at        timestamptz not null default now()
);

alter table mf_workouts enable row level security;
create policy "owner" on mf_workouts
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 6. mf_workout_sets
-- ─────────────────────────────────────────
create table mf_workout_sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references mf_workouts(id) on delete cascade,
  exercise_id uuid not null references mf_exercises(id) on delete cascade,
  set_number  integer not null,
  weight      numeric(6,2) not null default 0,
  reps        integer not null default 0,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table mf_workout_sets enable row level security;
create policy "owner" on mf_workout_sets
  using (
    exists (
      select 1 from mf_workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mf_workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- 7. mf_body_stats
-- ─────────────────────────────────────────
create table mf_body_stats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  recorded_at  timestamptz not null default now(),
  weight_kg    numeric(5,2),
  chest        numeric(5,1),
  waist        numeric(5,1),
  hips         numeric(5,1),
  left_thigh   numeric(5,1),
  right_thigh  numeric(5,1),
  left_calf    numeric(5,1),
  right_calf   numeric(5,1),
  left_arm     numeric(5,1),
  right_arm    numeric(5,1),
  wrist        numeric(5,1)
);

alter table mf_body_stats enable row level security;
create policy "owner" on mf_body_stats
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
