-- Add a governed product note for permission-specific help-page answers.
INSERT INTO rag_sources (id, source_type, name, uri, status, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000904', 'upload', 'AI-HRMS 产品与 Copilot 文档库', 'seed://ai-hrms-product-docs', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  name = EXCLUDED.name,
  uri = EXCLUDED.uri,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO rag_documents (id, source_id, title, version, status, trust_level, sensitivity, content, content_hash, published_at, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000933', '00000000-0000-0000-0000-000000000904', '管理员指南与可见性规则', 'v1', 'published', 'official', 'normal',
   '帮助页中的管理员指南只对 group_admin 角色可见。该区域包含账号维护、角色绑定、法人 scope、组织 scope、RAG 资料发布和高风险审计检查入口。普通用户、员工、导师或仅有 group_hr/org_manager 角色的账号不会看到管理员指南。如果用户询问“为什么看不了”或“为什么没有这块”，应优先解释为权限或角色可见性原因，并建议确认账号是否绑定 group_admin、scope 是否正确，以及在角色调整后重新登录或刷新页面。',
   encode(digest('管理员指南与可见性规则', 'sha256'), 'hex'), now(), NULL)
ON CONFLICT (id) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  title = EXCLUDED.title,
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  trust_level = EXCLUDED.trust_level,
  sensitivity = EXCLUDED.sensitivity,
  content = EXCLUDED.content,
  content_hash = EXCLUDED.content_hash,
  published_at = EXCLUDED.published_at,
  updated_at = now();

INSERT INTO rag_document_scopes (document_id, scope_type, scope_id, role_code, include_descendants)
SELECT d.id, 'global', NULL, NULL, true
FROM rag_documents d
WHERE d.id = '00000000-0000-0000-0000-000000000933'
AND NOT EXISTS (
  SELECT 1 FROM rag_document_scopes s
  WHERE s.document_id = d.id
    AND s.scope_type = 'global'
    AND s.scope_id IS NULL
    AND s.role_code IS NULL
    AND s.employee_id IS NULL
);

INSERT INTO rag_chunks (
  id, document_id, chunk_index, title, content, content_hash, sensitivity,
  section_path, body_content, context_prefix, chunk_strategy, token_budget, body_runes, overlap_runes
)
VALUES
  ('00000000-0000-0000-0000-000000000933', '00000000-0000-0000-0000-000000000933', 0, '管理员指南 group_admin 可见性',
   '管理员指南只对 group_admin 角色可见，包含账号、角色、法人 scope、组织 scope、RAG 资料发布和高风险审计检查。用户看不到该区域时，应先检查账号角色、scope 和登录状态，并在角色调整后重新登录或刷新。',
   encode(digest('管理员指南 group_admin 可见性', 'sha256'), 'hex'), 'normal', '帮助页/管理员指南',
   '管理员指南只对 group_admin 角色可见，包含账号、角色、法人 scope、组织 scope、RAG 资料发布和高风险审计检查。用户看不到该区域时，应先检查账号角色、scope 和登录状态，并在角色调整后重新登录或刷新。',
   '管理员指南与可见性规则', 'heading_sentence_context_v2_qwen3_2048', 2048, 94, 120)
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  content_hash = EXCLUDED.content_hash,
  sensitivity = EXCLUDED.sensitivity,
  section_path = EXCLUDED.section_path,
  body_content = EXCLUDED.body_content,
  context_prefix = EXCLUDED.context_prefix,
  chunk_strategy = EXCLUDED.chunk_strategy,
  token_budget = EXCLUDED.token_budget,
  body_runes = EXCLUDED.body_runes,
  overlap_runes = EXCLUDED.overlap_runes;

INSERT INTO rag_embeddings (chunk_id, provider, model, dimensions, embedding)
VALUES
  ('00000000-0000-0000-0000-000000000933', 'fake', 'deterministic-v1', 8, '[0.31,0.27,0.43,0.55,0.67,0.72,0.83,0.91]')
ON CONFLICT DO NOTHING;
