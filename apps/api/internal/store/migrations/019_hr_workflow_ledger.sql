CREATE TABLE IF NOT EXISTS hr_approval_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  record_id uuid NOT NULL,
  record_type text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  action text NOT NULL DEFAULT 'review',
  assigned_to_user_id uuid REFERENCES users(id),
  requested_by_user_id uuid REFERENCES users(id),
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  risk_level text NOT NULL DEFAULT 'medium',
  comment text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('open', 'approved', 'rejected', 'cancelled', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_approval_tasks_one_open
ON hr_approval_tasks (resource, record_id)
WHERE status = 'open';

CREATE INDEX IF NOT EXISTS hr_approval_tasks_status_idx
ON hr_approval_tasks (status, risk_level, created_at DESC);

CREATE TABLE IF NOT EXISTS hr_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  record_id uuid NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  from_status text NOT NULL DEFAULT '',
  to_status text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  risk_level text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_workflow_events_record_idx
ON hr_workflow_events (resource, record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS leave_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  leave_type_id uuid REFERENCES leave_types(id),
  leave_application_id uuid REFERENCES leave_applications(id),
  allocation_id uuid REFERENCES leave_allocations(id),
  transaction_type text NOT NULL,
  days numeric(6,2) NOT NULL,
  posting_date date NOT NULL DEFAULT current_date,
  from_date date,
  to_date date,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (transaction_type IN ('allocation', 'leave_approved', 'leave_cancelled', 'adjustment'))
);

CREATE UNIQUE INDEX IF NOT EXISTS leave_ledger_source_once
ON leave_ledger_entries (source_type, source_id, transaction_type);

CREATE INDEX IF NOT EXISTS leave_ledger_employee_idx
ON leave_ledger_entries (employee_id, leave_type_id, posting_date DESC);

CREATE TABLE IF NOT EXISTS employee_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  log_type text NOT NULL,
  log_time timestamptz NOT NULL DEFAULT now(),
  latitude numeric(10,6),
  longitude numeric(10,6),
  source text NOT NULL DEFAULT 'web',
  attendance_record_id uuid REFERENCES attendance_records(id),
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (log_type IN ('IN', 'OUT'))
);

CREATE INDEX IF NOT EXISTS employee_checkins_employee_time_idx
ON employee_checkins (employee_id, log_time DESC);

ALTER TABLE shift_types
ADD COLUMN IF NOT EXISTS late_grace_minutes integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS early_leave_grace_minutes integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS missing_checkout_after_minutes integer NOT NULL DEFAULT 720;

INSERT INTO capabilities (code, description)
VALUES
  ('leave.approve', 'Approve leave requests and write leave ledger entries'),
  ('recruitment.manage', 'Manage recruitment lifecycle workflow actions'),
  ('performance.review', 'Review performance and appraisal workflow actions'),
  ('payroll.read_sensitive', 'Read protected payroll previews')
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
JOIN capabilities c ON c.code IN ('leave.approve', 'attendance.manage', 'recruitment.manage', 'performance.review', 'payroll.read_sensitive')
WHERE r.code IN ('group_admin', 'group_hr')
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
JOIN capabilities c ON c.code IN ('leave.approve', 'attendance.manage', 'recruitment.manage', 'performance.review')
WHERE r.code IN ('entity_hr', 'org_manager')
ON CONFLICT DO NOTHING;

INSERT INTO leave_ledger_entries (
  employee_id, leave_type_id, allocation_id, transaction_type, days,
  posting_date, from_date, to_date, source_type, source_id, scope_type, scope_id
)
SELECT
  employee_id, leave_type_id, id, 'allocation', allocated_days,
  period_start, period_start, period_end, 'leave_allocation', id, scope_type, scope_id
FROM leave_allocations
WHERE allocated_days <> 0
ON CONFLICT DO NOTHING;
