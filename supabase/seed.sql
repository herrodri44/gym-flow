-- seed.sql — development seed
-- Run once in the Supabase SQL Editor

DO $$
DECLARE
  v_user_id uuid;
  v_gym_id  uuid;
BEGIN

  -- 1. Find your user (must already exist in auth.users)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'her.rodri44@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User her.rodri44@gmail.com not found in auth.users — create it first via Supabase Dashboard > Authentication > Users';
  END IF;

  -- 2. Set superadmin role in app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "superadmin"}'::jsonb
  WHERE id = v_user_id;

  -- 3. Upsert profile row
  INSERT INTO profiles (id, role, full_name, email)
  VALUES (v_user_id, 'superadmin', 'Hernan Rodriguez', 'her.rodri44@gmail.com')
  ON CONFLICT (id) DO UPDATE
    SET role      = 'superadmin',
        full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email;

  -- 4. Create a test gym
  INSERT INTO gyms (name, slug, timezone)
  VALUES ('CrossFit Palermo', 'crossfit-palermo', 'America/Argentina/Buenos_Aires')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_gym_id FROM gyms WHERE slug = 'crossfit-palermo';

  -- 5. Create gym settings with defaults
  INSERT INTO gym_settings (gym_id)
  VALUES (v_gym_id)
  ON CONFLICT (gym_id) DO NOTHING;

  RAISE NOTICE 'Seed complete — user % set as superadmin, gym % ready', v_user_id, v_gym_id;

END $$;
