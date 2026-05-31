-- Tighten scope field validation without mutating earlier applied migrations.

DELETE FROM rag_document_scopes
WHERE NOT (
  (scope_type = 'global' AND scope_id IS NULL AND role_code IS NULL AND employee_id IS NULL)
  OR (scope_type IN ('legal_entity', 'org_unit') AND scope_id IS NOT NULL AND role_code IS NULL AND employee_id IS NULL)
  OR (scope_type = 'role' AND role_code IS NOT NULL AND role_code <> '' AND employee_id IS NULL)
  OR (scope_type = 'employee' AND scope_id IS NULL AND employee_id IS NOT NULL AND role_code IS NULL)
);

UPDATE rag_documents d
SET status = 'draft',
    sensitivity = CASE WHEN sensitivity IN ('normal', 'public') THEN 'internal' ELSE sensitivity END,
    published_at = NULL,
    updated_at = now()
WHERE d.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM rag_document_scopes ds WHERE ds.document_id = d.id
  );

ALTER TABLE rag_document_scopes
  DROP CONSTRAINT IF EXISTS rag_scope_required_fields;

ALTER TABLE rag_document_scopes
  ADD CONSTRAINT rag_scope_required_fields CHECK (
    (scope_type = 'global' AND scope_id IS NULL AND role_code IS NULL AND employee_id IS NULL)
    OR (scope_type IN ('legal_entity', 'org_unit') AND scope_id IS NOT NULL AND role_code IS NULL AND employee_id IS NULL)
    OR (scope_type = 'role' AND role_code IS NOT NULL AND role_code <> '' AND employee_id IS NULL)
    OR (scope_type = 'employee' AND scope_id IS NULL AND employee_id IS NOT NULL AND role_code IS NULL)
  );
