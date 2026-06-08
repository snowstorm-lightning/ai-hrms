-- Production databases skip demo seed data, but later system-owned knowledge
-- migrations still need a stable actor for historical created_by_user_id FKs.
INSERT INTO users (id, mobile, username, password_hash, enable_state)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '__system_ai_hrms_seed__',
  'AI-HRMS System Seed',
  crypt(gen_random_uuid()::text, gen_salt('bf')),
  0
)
ON CONFLICT (id) DO NOTHING;
