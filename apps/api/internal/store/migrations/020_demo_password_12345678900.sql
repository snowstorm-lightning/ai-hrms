-- Align public demo and seeded reviewer accounts with the online guide credential.
UPDATE users
SET password_hash = crypt('12345678900', gen_salt('bf'))
WHERE mobile IN ('123', '100111', '100112', '100113', 'demo', '12345678900')
   OR id IN (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000305'
  );
