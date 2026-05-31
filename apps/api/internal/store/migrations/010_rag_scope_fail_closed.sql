-- Tighten the RAG governance defaults added after the original demo seed.
-- Existing seeded documents already have explicit scopes; any later published
-- document without a scope is quarantined back to draft so it cannot be cited.

UPDATE rag_documents d
SET status = 'draft',
    sensitivity = CASE WHEN sensitivity IN ('normal', 'public') THEN 'internal' ELSE sensitivity END,
    published_at = NULL,
    updated_at = now()
WHERE d.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM rag_document_scopes ds WHERE ds.document_id = d.id
  );

UPDATE messages SET
  content = '<p>本环境使用企鹅互联网科技有限公司（虚构样本组织）作为样本企业数据集，用于展示 AI-HRMS 的组织、知识、Agent 与审计闭环；它不是 SaaS 租户，也不代表真实公司。</p>',
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000701';

ALTER TABLE rag_document_scopes
  ADD CONSTRAINT rag_scope_required_fields CHECK (
    (scope_type = 'global' AND role_code IS NULL AND employee_id IS NULL)
    OR (scope_type IN ('legal_entity', 'org_unit') AND scope_id IS NOT NULL AND role_code IS NULL AND employee_id IS NULL)
    OR (scope_type = 'role' AND role_code IS NOT NULL AND role_code <> '' AND employee_id IS NULL)
    OR (scope_type = 'employee' AND employee_id IS NOT NULL AND role_code IS NULL)
  );
