package store

import (
	"context"
	"strings"

	"ai-hrms/apps/api/internal/domain"
)

func (s *Store) ListLegalEntities(ctx context.Context, scope Scope) ([]domain.LegalEntity, error) {
	query := `SELECT id::text, parent_id::text, code, name, legal_name, unified_social_credit_code, legal_representative, company_phone, email, area, address, status, created_at FROM legal_entities`
	args := []any{}
	if !scope.Global {
		condition, ids := whereIn("id::text", scope.legalIDs(), 1)
		if condition == "" {
			return []domain.LegalEntity{}, nil
		}
		query += " WHERE " + condition
		args = ids
	}
	query += " ORDER BY parent_id NULLS FIRST, name"
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entities []domain.LegalEntity
	for rows.Next() {
		var item domain.LegalEntity
		if err := rows.Scan(&item.ID, &item.ParentID, &item.Code, &item.Name, &item.LegalName, &item.UnifiedSocialCreditCode, &item.LegalRepresentative, &item.CompanyPhone, &item.Email, &item.Area, &item.Address, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		entities = append(entities, item)
	}
	return entities, rows.Err()
}

func (s *Store) SaveLegalEntity(ctx context.Context, item domain.LegalEntity) (*domain.LegalEntity, error) {
	var saved domain.LegalEntity
	err := s.pool.QueryRow(ctx, `
		INSERT INTO legal_entities (parent_id, code, name, legal_name, unified_social_credit_code, legal_representative, company_phone, email, area, address, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE(NULLIF($11, ''), 'active'))
		RETURNING id::text, parent_id::text, code, name, legal_name, unified_social_credit_code, legal_representative, company_phone, email, area, address, status, created_at
	`, item.ParentID, item.Code, item.Name, item.LegalName, item.UnifiedSocialCreditCode, item.LegalRepresentative, item.CompanyPhone, item.Email, item.Area, item.Address, item.Status).Scan(&saved.ID, &saved.ParentID, &saved.Code, &saved.Name, &saved.LegalName, &saved.UnifiedSocialCreditCode, &saved.LegalRepresentative, &saved.CompanyPhone, &saved.Email, &saved.Area, &saved.Address, &saved.Status, &saved.CreatedAt)
	return &saved, err
}

func (s *Store) UpdateLegalEntity(ctx context.Context, id string, item domain.LegalEntity) (*domain.LegalEntity, error) {
	var saved domain.LegalEntity
	err := s.pool.QueryRow(ctx, `
		UPDATE legal_entities
		SET parent_id=$2, code=$3, name=$4, legal_name=$5, unified_social_credit_code=$6, legal_representative=$7, company_phone=$8, email=$9, area=$10, address=$11, status=$12, updated_at=now()
		WHERE id=$1
		RETURNING id::text, parent_id::text, code, name, legal_name, unified_social_credit_code, legal_representative, company_phone, email, area, address, status, created_at
	`, id, item.ParentID, item.Code, item.Name, item.LegalName, item.UnifiedSocialCreditCode, item.LegalRepresentative, item.CompanyPhone, item.Email, item.Area, item.Address, item.Status).Scan(&saved.ID, &saved.ParentID, &saved.Code, &saved.Name, &saved.LegalName, &saved.UnifiedSocialCreditCode, &saved.LegalRepresentative, &saved.CompanyPhone, &saved.Email, &saved.Area, &saved.Address, &saved.Status, &saved.CreatedAt)
	return &saved, notFound(err)
}

func (s *Store) ListOrgUnits(ctx context.Context, scope Scope) ([]domain.OrgUnit, error) {
	query := `SELECT id::text, parent_id::text, legal_entity_id::text, code, name, type, manager_name, status, created_at FROM org_units`
	args := []any{}
	if !scope.Global {
		parts := []string{}
		legalCond, legalArgs := whereIn("legal_entity_id::text", scope.legalIDs(), 1)
		if legalCond != "" {
			parts = append(parts, legalCond)
			args = append(args, legalArgs...)
		}
		orgCond, orgArgs := whereIn("id::text", scope.orgIDs(), len(args)+1)
		if orgCond != "" {
			parts = append(parts, orgCond)
			args = append(args, orgArgs...)
		}
		if len(parts) == 0 {
			return []domain.OrgUnit{}, nil
		}
		query += " WHERE " + strings.Join(parts, " OR ")
	}
	query += " ORDER BY parent_id NULLS FIRST, name"
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var units []domain.OrgUnit
	for rows.Next() {
		var item domain.OrgUnit
		if err := rows.Scan(&item.ID, &item.ParentID, &item.LegalEntityID, &item.Code, &item.Name, &item.Type, &item.ManagerName, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		units = append(units, item)
	}
	return units, rows.Err()
}

func (s *Store) SaveOrgUnit(ctx context.Context, item domain.OrgUnit) (*domain.OrgUnit, error) {
	var saved domain.OrgUnit
	err := s.pool.QueryRow(ctx, `
		INSERT INTO org_units (parent_id, legal_entity_id, code, name, type, manager_name, status)
		VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, ''), 'department'), $6, COALESCE(NULLIF($7, ''), 'active'))
		RETURNING id::text, parent_id::text, legal_entity_id::text, code, name, type, manager_name, status, created_at
	`, item.ParentID, item.LegalEntityID, item.Code, item.Name, item.Type, item.ManagerName, item.Status).Scan(&saved.ID, &saved.ParentID, &saved.LegalEntityID, &saved.Code, &saved.Name, &saved.Type, &saved.ManagerName, &saved.Status, &saved.CreatedAt)
	return &saved, err
}

func (s *Store) UpdateOrgUnit(ctx context.Context, id string, item domain.OrgUnit) (*domain.OrgUnit, error) {
	var saved domain.OrgUnit
	err := s.pool.QueryRow(ctx, `
		UPDATE org_units
		SET parent_id=$2, legal_entity_id=$3, code=$4, name=$5, type=$6, manager_name=$7, status=$8, updated_at=now()
		WHERE id=$1
		RETURNING id::text, parent_id::text, legal_entity_id::text, code, name, type, manager_name, status, created_at
	`, id, item.ParentID, item.LegalEntityID, item.Code, item.Name, item.Type, item.ManagerName, item.Status).Scan(&saved.ID, &saved.ParentID, &saved.LegalEntityID, &saved.Code, &saved.Name, &saved.Type, &saved.ManagerName, &saved.Status, &saved.CreatedAt)
	return &saved, notFound(err)
}
