CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  paid boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT 'blue',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  leave_type_id uuid REFERENCES leave_types(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  allocated_days numeric(6,2) NOT NULL DEFAULT 0,
  used_days numeric(6,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS leave_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  leave_type_id uuid REFERENCES leave_types(id),
  title text NOT NULL DEFAULT 'Leave Application',
  from_date date,
  to_date date,
  total_leave_days numeric(6,2) NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  approver_user_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'low',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_date IS NULL OR from_date IS NULL OR to_date >= from_date)
);

CREATE TABLE IF NOT EXISTS attendance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Attendance Request',
  request_type text NOT NULL DEFAULT 'correction',
  from_date date,
  to_date date,
  reason text NOT NULL DEFAULT '',
  shift text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_date IS NULL OR from_date IS NULL OR to_date >= from_date)
);

CREATE TABLE IF NOT EXISTS shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  color text NOT NULL DEFAULT 'geekblue',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  shift_type_id uuid REFERENCES shift_types(id),
  title text NOT NULL DEFAULT 'Shift Assignment',
  start_date date,
  end_date date,
  shift_location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  risk_level text NOT NULL DEFAULT 'low',
  human_review_required boolean NOT NULL DEFAULT false,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS expense_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Expense Claim',
  expense_type text NOT NULL DEFAULT '',
  posting_date date,
  total_claimed_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_sanctioned_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CNY',
  approval_status text NOT NULL DEFAULT 'submitted',
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Employee Advance',
  posting_date date,
  requested_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Salary Slip',
  period_start date,
  period_end date,
  gross_pay numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'draft',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Job Requisition',
  position_title text NOT NULL DEFAULT '',
  openings integer NOT NULL DEFAULT 1,
  expected_onboarding_date date,
  budget_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  requisition_id uuid REFERENCES job_requisitions(id),
  title text NOT NULL DEFAULT 'Job Opening',
  position_title text NOT NULL DEFAULT '',
  openings integer NOT NULL DEFAULT 1,
  salary_range text NOT NULL DEFAULT '',
  closes_on date,
  status text NOT NULL DEFAULT 'open',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  job_opening_id uuid REFERENCES job_openings(id),
  title text NOT NULL DEFAULT 'Job Applicant',
  applicant_name text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  rating numeric(4,2),
  stage text NOT NULL DEFAULT 'screening',
  status text NOT NULL DEFAULT 'active',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  job_applicant_id uuid REFERENCES job_applicants(id),
  title text NOT NULL DEFAULT 'Interview',
  interview_type text NOT NULL DEFAULT '',
  interviewer_name text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  score numeric(4,2),
  status text NOT NULL DEFAULT 'scheduled',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_id uuid REFERENCES org_units(id),
  interview_id uuid REFERENCES interviews(id),
  title text NOT NULL DEFAULT 'Interview Feedback',
  reviewer_name text NOT NULL DEFAULT '',
  score numeric(4,2),
  feedback_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  job_applicant_id uuid REFERENCES job_applicants(id),
  title text NOT NULL DEFAULT 'Job Offer',
  offer_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CNY',
  expected_joining_date date,
  status text NOT NULL DEFAULT 'draft',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Employee Lifecycle Event',
  event_type text NOT NULL DEFAULT 'onboarding',
  effective_date date,
  status text NOT NULL DEFAULT 'planned',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  program_id uuid REFERENCES training_programs(id),
  title text NOT NULL DEFAULT 'Training Event',
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'planned',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT false,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  training_event_id uuid REFERENCES training_events(id),
  title text NOT NULL DEFAULT 'Training Result',
  score numeric(5,2),
  evidence_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  training_event_id uuid REFERENCES training_events(id),
  title text NOT NULL DEFAULT 'Training Feedback',
  reviewer_name text NOT NULL DEFAULT '',
  feedback_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  parent_goal_id uuid REFERENCES performance_goals(id),
  title text NOT NULL DEFAULT 'Performance Goal',
  progress numeric(5,2) NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'active',
  risk_level text NOT NULL DEFAULT 'medium',
  human_review_required boolean NOT NULL DEFAULT false,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appraisal_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  title text NOT NULL DEFAULT 'Appraisal Cycle',
  period_start date,
  period_end date,
  formula_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  appraisal_cycle_id uuid REFERENCES appraisal_cycles(id),
  title text NOT NULL DEFAULT 'Appraisal',
  self_score numeric(5,2),
  feedback_score numeric(5,2),
  final_score numeric(5,2),
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  org_unit_id uuid REFERENCES org_units(id),
  appraisal_id uuid REFERENCES appraisals(id),
  title text NOT NULL DEFAULT 'Performance Feedback',
  reviewer_name text NOT NULL DEFAULT '',
  feedback_summary text NOT NULL DEFAULT '',
  score numeric(5,2),
  status text NOT NULL DEFAULT 'submitted',
  risk_level text NOT NULL DEFAULT 'high',
  human_review_required boolean NOT NULL DEFAULT true,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO leave_types (code, name, paid, color)
VALUES
  ('annual', '年假', true, 'green'),
  ('personal', '事假', false, 'orange'),
  ('sick', '病假', true, 'red')
ON CONFLICT (code) DO NOTHING;

INSERT INTO shift_types (code, name, start_time, end_time, color)
VALUES
  ('day', '标准白班', '09:00', '18:00', 'geekblue'),
  ('flex', '弹性班次', '10:00', '19:00', 'purple')
ON CONFLICT (code) DO NOTHING;
