CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES legal_entities(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text NOT NULL DEFAULT '',
  unified_social_credit_code text NOT NULL DEFAULT '',
  legal_representative text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES org_units(id),
  legal_entity_id uuid REFERENCES legal_entities(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'department',
  manager_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL UNIQUE,
  username text NOT NULL,
  password_hash text NOT NULL,
  enable_state integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id),
  employee_no text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  sex text NOT NULL DEFAULT '',
  date_of_birth text NOT NULL DEFAULT '',
  highest_degree_of_education text NOT NULL DEFAULT '',
  national_area text NOT NULL DEFAULT '',
  passport_no text NOT NULL DEFAULT '',
  id_number text NOT NULL DEFAULT '',
  native_place text NOT NULL DEFAULT '',
  nation text NOT NULL DEFAULT '',
  english_name text NOT NULL DEFAULT '',
  marital_status text NOT NULL DEFAULT '',
  birthday text NOT NULL DEFAULT '',
  zodiac text NOT NULL DEFAULT '',
  age text NOT NULL DEFAULT '',
  constellation text NOT NULL DEFAULT '',
  blood_type text NOT NULL DEFAULT '',
  domicile text NOT NULL DEFAULT '',
  political_outlook text NOT NULL DEFAULT '',
  qq text NOT NULL DEFAULT '',
  wechat text NOT NULL DEFAULT '',
  place_of_residence text NOT NULL DEFAULT '',
  postal_address text NOT NULL DEFAULT '',
  personal_mailbox text NOT NULL DEFAULT '',
  emergency_contact text NOT NULL DEFAULT '',
  emergency_contact_number text NOT NULL DEFAULT '',
  bank_card_number text NOT NULL DEFAULT '',
  opening_bank text NOT NULL DEFAULT '',
  graduate_school text NOT NULL DEFAULT '',
  major text NOT NULL DEFAULT '',
  home_company text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  resume text NOT NULL DEFAULT '',
  is_there_any_competition_restriction text NOT NULL DEFAULT '',
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  legal_entity_id uuid REFERENCES legal_entities(id),
  org_unit_id uuid REFERENCES org_units(id),
  position_title text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  allocation_ratio numeric(5,2),
  employment_type text NOT NULL DEFAULT 'full_time',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_assignments_one_current_primary
ON employee_assignments(employee_id)
WHERE is_primary AND end_date IS NULL;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_role_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  scope_type text NOT NULL,
  scope_id uuid,
  include_descendants boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scope_type IN ('global', 'legal_entity', 'org_unit')),
  CHECK ((scope_type = 'global' AND scope_id IS NULL) OR (scope_type <> 'global' AND scope_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  attendance_status integer NOT NULL DEFAULT 1,
  attendance_in_time timestamptz,
  attendance_out_time timestamptz,
  attendance_in_place text NOT NULL DEFAULT '',
  day text NOT NULL,
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  author_user_id uuid REFERENCES users(id),
  org_unit_id uuid REFERENCES org_units(id),
  star integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tool_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}',
  resolved_scope jsonb NOT NULL DEFAULT '{}',
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
