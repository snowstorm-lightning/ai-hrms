DO $$
DECLARE
  admin_role_id uuid;
  demo_user_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000301'
  ) THEN
    SELECT id INTO admin_role_id FROM roles WHERE code = 'group_admin';

    INSERT INTO users (id, mobile, username, password_hash, enable_state)
    VALUES (
      '00000000-0000-0000-0000-000000000305',
      'demo',
      'demo',
      crypt('password', gen_salt('bf')),
      1
    )
    ON CONFLICT (mobile) DO UPDATE SET
      username = EXCLUDED.username,
      enable_state = 1
    RETURNING id INTO demo_user_id;

    IF admin_role_id IS NOT NULL THEN
      INSERT INTO user_role_bindings (user_id, role_id, scope_type, scope_id, include_descendants)
      VALUES (demo_user_id, admin_role_id, 'global', NULL, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
