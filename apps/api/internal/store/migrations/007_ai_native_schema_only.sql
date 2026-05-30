-- Schema-only AI-native layer for non-demo deployments.
-- Demo data remains gated by AI_HRMS_ENABLE_DEMO_SEED.

CREATE TABLE IF NOT EXISTS capabilities (
  code text PRIMARY KEY,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_capabilities (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  capability_code text NOT NULL REFERENCES capabilities(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, capability_code)
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'global';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS scope_id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS include_descendants boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  event_type text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL DEFAULT '',
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  request_id text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'api',
  risk_level text NOT NULL DEFAULT 'low',
  old_value_summary jsonb NOT NULL DEFAULT '{}',
  new_value_summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('upload', 'directory', 'url', 'connector')),
  name text NOT NULL,
  uri text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES rag_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'draft',
  trust_level text NOT NULL DEFAULT 'internal',
  sensitivity text NOT NULL DEFAULT 'normal',
  content text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  effective_from timestamptz,
  effective_to timestamptz,
  published_at timestamptz,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_document_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('global', 'legal_entity', 'org_unit', 'role', 'employee')),
  scope_id uuid,
  role_code text,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  include_descendants boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL,
  page_ref text NOT NULL DEFAULT '',
  location_ref text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  sensitivity text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS rag_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'fake',
  model text NOT NULL DEFAULT 'deterministic-v1',
  dimensions integer NOT NULL DEFAULT 8,
  embedding vector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, provider, model)
);

ALTER TABLE rag_embeddings
  ALTER COLUMN embedding TYPE vector USING embedding::vector;

CREATE TABLE IF NOT EXISTS rag_ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES rag_sources(id) ON DELETE SET NULL,
  document_id uuid REFERENCES rag_documents(id) ON DELETE SET NULL,
  job_type text NOT NULL DEFAULT 'ingest',
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'fake',
  summary text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS rag_retrieval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  query text NOT NULL,
  resolved_scope jsonb NOT NULL DEFAULT '{}',
  hit_chunk_ids jsonb NOT NULL DEFAULT '[]',
  citations jsonb NOT NULL DEFAULT '[]',
  rejected_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  rag_document_id uuid REFERENCES rag_documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_type text NOT NULL DEFAULT 'global',
  target_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_path_courses (
  path_id uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (path_id, course_id)
);

CREATE TABLE IF NOT EXISTS learning_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned',
  due_date date,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, course_id)
);

CREATE TABLE IF NOT EXISTS learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES learning_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES learning_lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  score numeric(5,2),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES learning_assessments(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  scenario text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS learning_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL DEFAULT 'course',
  title text NOT NULL,
  reason text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES learning_enrollments(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  content text NOT NULL,
  rating integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  actor_user_id uuid REFERENCES users(id),
  delegated_context jsonb NOT NULL DEFAULT '{}',
  provider text NOT NULL DEFAULT 'fake',
  model text NOT NULL DEFAULT 'deterministic-v1',
  prompt_version text NOT NULL DEFAULT 'v1',
  risk_level text NOT NULL DEFAULT 'low',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}',
  sanitized_arguments jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'previewed',
  result_summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS agent_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  title text NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'draft',
  plan jsonb NOT NULL DEFAULT '[]',
  requires_confirmation boolean NOT NULL DEFAULT true,
  rollback_plan jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_action_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES agent_action_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  result jsonb NOT NULL DEFAULT '{}',
  audit_event_id uuid REFERENCES audit_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visual_copilot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  route text NOT NULL,
  instruction text NOT NULL DEFAULT '',
  regions jsonb NOT NULL DEFAULT '[]',
  dom_summary jsonb NOT NULL DEFAULT '{}',
  screenshot_hash text NOT NULL DEFAULT '',
  business_refs jsonb NOT NULL DEFAULT '[]',
  intent text NOT NULL DEFAULT '',
  confidence numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'captured',
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_scope ON messages(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created ON audit_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_rag_scopes_document ON rag_document_scopes(document_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_provider_model_dim ON rag_embeddings (provider, model, dimensions);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_chunk_id ON rag_embeddings (chunk_id);
CREATE INDEX IF NOT EXISTS idx_rag_retrieval_logs_created_at ON rag_retrieval_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_courses_scope ON learning_courses(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_actor_created ON agent_runs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_events_actor_created ON visual_copilot_events(actor_user_id, created_at DESC);

INSERT INTO capabilities (code, description)
VALUES
  ('employee.read', 'Read employees in scope'),
  ('employee.write', 'Write employees in scope'),
  ('attendance.manage', 'Manage attendance in scope'),
  ('message.manage', 'Manage scoped messages'),
  ('rag.search', 'Search scoped knowledge'),
  ('rag.publish', 'Publish scoped knowledge'),
  ('learning.view', 'View learning content'),
  ('learning.manage', 'Manage learning content'),
  ('agent.execute_read', 'Run read-only agents'),
  ('agent.execute_write', 'Run agent write actions'),
  ('visual_copilot.use', 'Use visual copilot'),
  ('audit.read', 'Read audit events')
ON CONFLICT (code) DO NOTHING;
