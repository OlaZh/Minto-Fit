-- MintoFit — Seed data
-- Запускати в Supabase SQL Editor після supabase_schema.sql
-- Підхожить для одного користувача (особистий застосунок)

DO $$
DECLARE
  uid uuid;

  -- Programs
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  p5 uuid; p6 uuid; p7 uuid; p8 uuid; p9 uuid; p10 uuid;

  -- Exercises
  e_leg_press_high    uuid;
  e_leg_curl          uuid;
  e_rdl               uuid;
  e_cable_kickback    uuid;
  e_crunches_plank    uuid;
  e_low_row           uuid;
  e_chest_press       uuid;
  e_pec_fly           uuid;
  e_tricep_pushdown   uuid;
  e_leg_press_center  uuid;
  e_leg_extension     uuid;
  e_adductor          uuid;
  e_step_up           uuid;
  e_shoulder_press    uuid;
  e_reverse_fly       uuid;
  e_ez_curl           uuid;
  e_elliptical        uuid;
  e_cat_cow           uuid;
  e_treadmill         uuid;
  e_band_steps        uuid;
  e_elbow_plank       uuid;
  e_lat_pulldown      uuid;
  e_abductor          uuid;
  e_goblet_squat      uuid;
  e_db_row            uuid;
  e_glute_bridge      uuid;
  e_db_bench          uuid;

BEGIN
  SELECT id INTO uid FROM auth.users LIMIT 1;

  -- ─────────────────────────────────────────
  -- PROGRAMS
  -- ─────────────────────────────────────────

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'День 1 — Низ тіла (сідниці)', 'основна', '#6366f1', '🍑')
    RETURNING id INTO p1;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'День 2 — Верх тіла (спина, груди, руки)', 'основна', '#3b82f6', '💪')
    RETURNING id INTO p2;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'День 3 — Низ тіла (квадрицепси)', 'основна', '#8b5cf6', '🦵')
    RETURNING id INTO p3;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'День 4 — Верх тіла (плечі та прес)', 'основна', '#ec4899', '🏋️')
    RETURNING id INTO p4;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'Легке 1 — Дзен на кардіо', 'додаткова', '#10b981', '🧘')
    RETURNING id INTO p5;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'Легке 2 — М''який тонус', 'додаткова', '#14b8a6', '🌿')
    RETURNING id INTO p6;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'Мікс 1 — Full Body', 'додаткова', '#f59e0b', '🔥')
    RETURNING id INTO p7;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'Мікс 2 — Бережемо ноги', 'додаткова', '#f97316', '🩹')
    RETURNING id INTO p8;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'Мікс 3 — Бережемо верх', 'додаткова', '#84cc16', '🪑')
    RETURNING id INTO p9;

  INSERT INTO mf_programs (user_id, name, type, color, emoji) VALUES
    (uid, 'Мікс 4 — Куточок інтроверта', 'додаткова', '#a78bfa', '🎯')
    RETURNING id INTO p10;

  -- ─────────────────────────────────────────
  -- EXERCISES
  -- ─────────────────────────────────────────

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Жим ногами — висока постановка стоп', 'Сідниці, задня поверхня стегна')
    RETURNING id INTO e_leg_press_high;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Згинання ніг сидячи (Leg Curl)', 'Задня поверхня стегна')
    RETURNING id INTO e_leg_curl;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Румунська тяга з гантелями', 'Задня поверхня стегна, сідниці')
    RETURNING id INTO e_rdl;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Відведення ноги назад із нижнього блоку', 'Сідниці')
    RETURNING id INTO e_cable_kickback;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Скручування + Планка', 'Прямий м''яз живота, кор')
    RETURNING id INTO e_crunches_plank;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Тяга до пояса (Low Row)', 'Широкий м''яз спини, ромбоподібні, біцепс')
    RETURNING id INTO e_low_row;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Жим від грудей (Chest Press)', 'Грудні, трицепс, передня дельта')
    RETURNING id INTO e_chest_press;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Зведення рук на груди (Метелик)', 'Грудні')
    RETURNING id INTO e_pec_fly;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Розгинання рук на трицепс (канат)', 'Трицепс')
    RETURNING id INTO e_tricep_pushdown;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Жим ногами — класична постановка стоп', 'Квадрицепси')
    RETURNING id INTO e_leg_press_center;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Розгинання ніг сидячи (Leg Extension)', 'Квадрицепси')
    RETURNING id INTO e_leg_extension;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Зведення ніг (Adductor)', 'Внутрішня поверхня стегна')
    RETURNING id INTO e_adductor;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Зашагування на тумбу', 'Квадрицепси, сідниці')
    RETURNING id INTO e_step_up;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Вертикальний жим сидячи (Shoulder Press)', 'Дельтоподібні, трицепс')
    RETURNING id INTO e_shoulder_press;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Відведення рук назад (Reverse Fly)', 'Задня дельта, ромбоподібні')
    RETURNING id INTO e_reverse_fly;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Згинання на біцепс (EZ-гриф)', 'Біцепс')
    RETURNING id INTO e_ez_curl;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Еліпс або велотренажер', 'Кардіо')
    RETURNING id INTO e_elliptical;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Кішка-Корова + нахили до ніг', 'Розтяжка, спина')
    RETURNING id INTO e_cat_cow;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Швидка ходьба на доріжці', 'Кардіо')
    RETURNING id INTO e_treadmill;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Кроки вбік у напівприсяді (гумка)', 'Сідниці, відвідні м''язи стегна')
    RETURNING id INTO e_band_steps;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Планка на ліктях', 'Кор')
    RETURNING id INTO e_elbow_plank;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Тяга верхнього блоку до грудей (Lat Pulldown)', 'Широкий м''яз спини, біцепс')
    RETURNING id INTO e_lat_pulldown;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Відведення ніг (Abductor)', 'Середній сідничний м''яз')
    RETURNING id INTO e_abductor;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Гоблет-присід із гантеллю', 'Квадрицепси, сідниці, кор')
    RETURNING id INTO e_goblet_squat;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Тяга гантелі в нахилі', 'Широкий м''яз спини, біцепс')
    RETURNING id INTO e_db_row;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Сідничний міст із гантеллю', 'Сідниці, задня поверхня стегна')
    RETURNING id INTO e_glute_bridge;

  INSERT INTO mf_exercises (user_id, name, muscle_group) VALUES
    (uid, 'Жим гантелей лежачи', 'Груди, трицепс, передня дельта')
    RETURNING id INTO e_db_bench;

  -- ─────────────────────────────────────────
  -- PROGRAM EXERCISES
  -- ─────────────────────────────────────────

  -- День 1 — Низ тіла (сідниці)
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p1, e_leg_press_high,  1, 3, 12),
    (p1, e_leg_curl,        2, 3, 12),
    (p1, e_rdl,             3, 3, 12),
    (p1, e_cable_kickback,  4, 3, 12),
    (p1, e_crunches_plank,  5, 3, 15);

  -- День 2 — Верх тіла (спина, груди, руки)
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p2, e_low_row,          1, 3, 12),
    (p2, e_chest_press,      2, 3, 12),
    (p2, e_pec_fly,          3, 3, 12),
    (p2, e_tricep_pushdown,  4, 3, 12);

  -- День 3 — Низ тіла (квадрицепси)
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p3, e_leg_press_center, 1, 3, 12),
    (p3, e_leg_extension,    2, 3, 12),
    (p3, e_adductor,         3, 3, 12),
    (p3, e_step_up,          4, 3, 12),
    (p3, e_crunches_plank,   5, 3, 15);

  -- День 4 — Верх тіла (плечі та прес)
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p4, e_shoulder_press,  1, 3, 12),
    (p4, e_reverse_fly,     2, 3, 12),
    (p4, e_ez_curl,         3, 3, 12),
    (p4, e_crunches_plank,  4, 3, 15);

  -- Легке 1 — Дзен на кардіо
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p5, e_elliptical, 1, 1, 1),
    (p5, e_cat_cow,    2, 1, 1);

  -- Легке 2 — М'який тонус
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p6, e_treadmill,   1, 1, 1),
    (p6, e_band_steps,  2, 3, 20),
    (p6, e_elbow_plank, 3, 3, 1);

  -- Мікс 1 — Full Body
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p7, e_leg_press_center, 1, 3, 12),
    (p7, e_low_row,          2, 3, 12),
    (p7, e_chest_press,      3, 3, 12),
    (p7, e_crunches_plank,   4, 3, 15);

  -- Мікс 2 — Бережемо ноги
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p8, e_lat_pulldown,    1, 3, 12),
    (p8, e_shoulder_press,  2, 3, 12),
    (p8, e_tricep_pushdown, 3, 3, 12),
    (p8, e_ez_curl,         4, 3, 12);

  -- Мікс 3 — Бережемо верх
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p9, e_leg_extension, 1, 3, 12),
    (p9, e_leg_curl,      2, 3, 12),
    (p9, e_adductor,      3, 3, 12),
    (p9, e_abductor,      4, 3, 12);

  -- Мікс 4 — Куточок інтроверта
  INSERT INTO mf_program_exercises (program_id, exercise_id, "order", default_sets, default_reps) VALUES
    (p10, e_goblet_squat, 1, 3, 12),
    (p10, e_db_row,       2, 3, 12),
    (p10, e_glute_bridge, 3, 3, 12),
    (p10, e_db_bench,     4, 3, 12);

  -- ─────────────────────────────────────────
  -- ALTERNATIVE EXERCISES
  -- ─────────────────────────────────────────

  -- Жим ногами (обидва варіанти — альтернативи одне одному)
  INSERT INTO mf_alternative_exercises (exercise_id, alternative_exercise_id) VALUES
    (e_leg_press_high, e_leg_press_center),
    (e_leg_press_center, e_leg_press_high);

  -- Тяга до пояса ↔ Тяга гантелі в нахилі
  INSERT INTO mf_alternative_exercises (exercise_id, alternative_exercise_id) VALUES
    (e_low_row, e_db_row),
    (e_db_row, e_low_row);

  -- Lat Pulldown ↔ Тяга до пояса
  INSERT INTO mf_alternative_exercises (exercise_id, alternative_exercise_id) VALUES
    (e_lat_pulldown, e_low_row),
    (e_low_row, e_lat_pulldown);

  -- Chest Press ↔ Жим гантелей лежачи
  INSERT INTO mf_alternative_exercises (exercise_id, alternative_exercise_id) VALUES
    (e_chest_press, e_db_bench),
    (e_db_bench, e_chest_press);

  -- РДТ ↔ Сідничний міст
  INSERT INTO mf_alternative_exercises (exercise_id, alternative_exercise_id) VALUES
    (e_rdl, e_glute_bridge),
    (e_glute_bridge, e_rdl);

END;
$$;
