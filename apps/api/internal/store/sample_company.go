package store

import (
	"context"
	"fmt"

	_ "embed"
)

//go:embed seeds/sample_company.sql
var sampleCompanySQL string

func (s *Store) SeedSampleCompany(ctx context.Context) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		CREATE TEMP TABLE ai_hrms_seed_actor (
			id uuid
		) ON COMMIT DROP
	`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO ai_hrms_seed_actor (id)
		SELECT u.id
		FROM users u
		JOIN user_role_bindings urb ON urb.user_id = u.id
		JOIN roles r ON r.id = urb.role_id
		WHERE r.code = 'group_admin'
		  AND urb.scope_type = 'global'
		ORDER BY u.created_at, u.id
		LIMIT 1
	`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, sampleCompanySQL); err != nil {
		return fmt.Errorf("seed sample company: %w", err)
	}
	return tx.Commit(ctx)
}
