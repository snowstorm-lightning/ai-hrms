UPDATE employee_assignments
SET position_title = '协同产品研发管理者', legal_entity_id = '00000000-0000-0000-0000-000000000103', org_unit_id = '00000000-0000-0000-0000-000000000204'
WHERE employee_id = '00000000-0000-0000-0000-000000000405'
  AND is_primary
  AND end_date IS NULL;

UPDATE employee_assignments
SET position_title = 'AI 安全与审计负责人', legal_entity_id = '00000000-0000-0000-0000-000000000104', org_unit_id = '00000000-0000-0000-0000-000000000207'
WHERE employee_id = '00000000-0000-0000-0000-000000000406'
  AND is_primary
  AND end_date IS NULL;
