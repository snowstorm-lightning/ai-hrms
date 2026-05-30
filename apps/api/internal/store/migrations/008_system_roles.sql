-- System roles are product configuration, not demo seed data. Keep them
-- available when AI_HRMS_ENABLE_DEMO_SEED=false so production can bootstrap
-- the first administrator without loading sample company records.

INSERT INTO roles (id, code, name)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'group_admin', '集团管理员'),
  ('00000000-0000-0000-0000-000000000502', 'group_hr', '集团 HR'),
  ('00000000-0000-0000-0000-000000000503', 'entity_hr', '子公司 HR'),
  ('00000000-0000-0000-0000-000000000504', 'org_manager', '组织负责人'),
  ('00000000-0000-0000-0000-000000000505', 'employee', '员工')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
CROSS JOIN capabilities c
WHERE r.code = 'group_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
JOIN capabilities c ON c.code IN (
  'employee.read', 'employee.write', 'attendance.manage', 'message.manage',
  'rag.search', 'rag.publish', 'learning.view', 'learning.manage',
  'agent.execute_read', 'agent.execute_write', 'visual_copilot.use', 'audit.read'
)
WHERE r.code = 'group_hr'
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
JOIN capabilities c ON c.code IN (
  'employee.read', 'employee.write', 'attendance.manage', 'message.manage',
  'rag.search', 'learning.view', 'agent.execute_read', 'visual_copilot.use', 'audit.read'
)
WHERE r.code IN ('entity_hr', 'org_manager')
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
JOIN capabilities c ON c.code IN ('learning.view', 'rag.search', 'visual_copilot.use')
WHERE r.code = 'employee'
ON CONFLICT DO NOTHING;
