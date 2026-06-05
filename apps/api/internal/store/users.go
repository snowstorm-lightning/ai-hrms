package store

import (
	"context"

	"ai-hrms/apps/api/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

func (s *Store) Authenticate(ctx context.Context, mobile, password string) (*domain.User, error) {
	var user domain.User
	var hash string
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, mobile, username, password_hash, enable_state, created_at
		FROM users
		WHERE mobile = $1 AND enable_state = 1
	`, mobile).Scan(&user.ID, &user.Mobile, &user.Username, &hash, &user.EnableState, &user.CreatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, ErrNotFound
	}
	user.Roles, err = s.userRoles(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Store) GetUser(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, mobile, username, enable_state, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&user.ID, &user.Mobile, &user.Username, &user.EnableState, &user.CreatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	user.Roles, err = s.userRoles(ctx, id)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Store) userRoles(ctx context.Context, id string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT r.code
		FROM user_role_bindings urb
		JOIN roles r ON r.id = urb.role_id
		WHERE urb.user_id = $1
		ORDER BY r.code
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []string
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func (s *Store) ListUsers(ctx context.Context, page, size int) ([]domain.User, int64, error) {
	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, mobile, username, enable_state, created_at
		FROM users
		ORDER BY created_at DESC, username
		LIMIT $1 OFFSET $2
	`, size, (page-1)*size)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var users []domain.User
	for rows.Next() {
		var user domain.User
		if err := rows.Scan(&user.ID, &user.Mobile, &user.Username, &user.EnableState, &user.CreatedAt); err != nil {
			return nil, 0, err
		}
		user.Roles, err = s.userRoles(ctx, user.ID)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}
	return users, total, rows.Err()
}

func (s *Store) CreateUser(ctx context.Context, mobile, username, password string) (*domain.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	var user domain.User
	err = s.pool.QueryRow(ctx, `
		INSERT INTO users (mobile, username, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id::text, mobile, username, enable_state, created_at
	`, mobile, username, string(hash)).Scan(&user.ID, &user.Mobile, &user.Username, &user.EnableState, &user.CreatedAt)
	return &user, err
}

func (s *Store) BootstrapAdmin(ctx context.Context, mobile, username, password string) (*domain.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var user domain.User
	err = tx.QueryRow(ctx, `
		INSERT INTO users (mobile, username, password_hash, enable_state)
		VALUES ($1, $2, $3, 1)
		ON CONFLICT (mobile) DO UPDATE SET
			username = EXCLUDED.username,
			password_hash = EXCLUDED.password_hash,
			enable_state = 1,
			updated_at = now()
		RETURNING id::text, mobile, username, enable_state, created_at
	`, mobile, username, string(hash)).Scan(&user.ID, &user.Mobile, &user.Username, &user.EnableState, &user.CreatedAt)
	if err != nil {
		return nil, err
	}
	tag, err := tx.Exec(ctx, `
		INSERT INTO user_role_bindings (user_id, role_id, scope_type, scope_id, include_descendants)
		SELECT $1, r.id, 'global', NULL, true
		FROM roles r
		WHERE r.code = 'group_admin'
		  AND NOT EXISTS (
		    SELECT 1
		    FROM user_role_bindings urb
		    JOIN roles existing_role ON existing_role.id = urb.role_id
		    WHERE urb.user_id = $1
		      AND existing_role.code = 'group_admin'
		      AND urb.scope_type = 'global'
		  )
	`, user.ID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		var hasBinding bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM user_role_bindings urb
				JOIN roles r ON r.id = urb.role_id
				WHERE urb.user_id = $1
				  AND r.code = 'group_admin'
				  AND urb.scope_type = 'global'
			)
		`, user.ID).Scan(&hasBinding); err != nil {
			return nil, err
		}
		if !hasBinding {
			return nil, ErrNotFound
		}
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_events (
			actor_user_id, event_type, object_type, object_id, scope_type,
			request_id, source, risk_level, old_value_summary, new_value_summary
		)
		VALUES (NULL, 'security.bootstrap_admin.created', 'user', $1, 'global',
			'bootstrap-admin', 'cli', 'medium', '{}'::jsonb, jsonb_build_object('mobile', $2::text, 'role', 'group_admin'))
	`, user.ID, user.Mobile); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	user.Roles = []string{"group_admin"}
	return &user, nil
}

func (s *Store) UpdateUser(ctx context.Context, id, username string, enableState int) (*domain.User, error) {
	var user domain.User
	err := s.pool.QueryRow(ctx, `
		UPDATE users
		SET username = $2, enable_state = $3, updated_at = now()
		WHERE id = $1
		RETURNING id::text, mobile, username, enable_state, created_at
	`, id, username, enableState).Scan(&user.ID, &user.Mobile, &user.Username, &user.EnableState, &user.CreatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	user.Roles, err = s.userRoles(ctx, id)
	return &user, err
}

func (s *Store) ListRoles(ctx context.Context) ([]domain.Role, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, code, name
		FROM roles
		ORDER BY code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.ID, &role.Code, &role.Name); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func (s *Store) ListCapabilities(ctx context.Context) ([]domain.Capability, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT code, description
		FROM capabilities
		ORDER BY code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var capabilities []domain.Capability
	for rows.Next() {
		var capability domain.Capability
		if err := rows.Scan(&capability.Code, &capability.Description); err != nil {
			return nil, err
		}
		capabilities = append(capabilities, capability)
	}
	return capabilities, rows.Err()
}

func (s *Store) ListUserRoleBindings(ctx context.Context, userID string) ([]domain.RoleBinding, error) {
	var exists int
	if err := s.pool.QueryRow(ctx, `SELECT 1 FROM users WHERE id = $1`, userID).Scan(&exists); err != nil {
		return nil, notFound(err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT urb.id::text, urb.user_id::text, r.id::text, r.code, r.name,
			urb.scope_type, urb.scope_id::text,
			COALESCE(CASE
				WHEN urb.scope_type = 'legal_entity' THEN le.name
				WHEN urb.scope_type = 'org_unit' THEN ou.name
				ELSE '全集团'
			END, ''),
			urb.include_descendants, urb.created_at
		FROM user_role_bindings urb
		JOIN roles r ON r.id = urb.role_id
		LEFT JOIN legal_entities le ON le.id = urb.scope_id AND urb.scope_type = 'legal_entity'
		LEFT JOIN org_units ou ON ou.id = urb.scope_id AND urb.scope_type = 'org_unit'
		WHERE urb.user_id = $1
		ORDER BY r.code, urb.created_at
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bindings []domain.RoleBinding
	for rows.Next() {
		var binding domain.RoleBinding
		if err := rows.Scan(&binding.ID, &binding.UserID, &binding.RoleID, &binding.RoleCode, &binding.RoleName, &binding.ScopeType, &binding.ScopeID, &binding.ScopeName, &binding.IncludeDescendants, &binding.CreatedAt); err != nil {
			return nil, err
		}
		bindings = append(bindings, binding)
	}
	return bindings, rows.Err()
}

func (s *Store) ReplaceUserRoleBindings(ctx context.Context, userID string, bindings []domain.RoleBinding) ([]domain.RoleBinding, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var exists int
	if err := tx.QueryRow(ctx, `SELECT 1 FROM users WHERE id = $1`, userID).Scan(&exists); err != nil {
		return nil, notFound(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_role_bindings WHERE user_id = $1`, userID); err != nil {
		return nil, err
	}
	for _, binding := range bindings {
		scopeID := binding.ScopeID
		if binding.ScopeType == "global" {
			scopeID = nil
		} else if scopeID != nil {
			var scopeExists int
			query := `SELECT 1 FROM legal_entities WHERE id = $1`
			if binding.ScopeType == "org_unit" {
				query = `SELECT 1 FROM org_units WHERE id = $1`
			}
			if err := tx.QueryRow(ctx, query, *scopeID).Scan(&scopeExists); err != nil {
				return nil, notFound(err)
			}
		}
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_role_bindings (user_id, role_id, scope_type, scope_id, include_descendants)
			SELECT $1, r.id, $3, $4, $5
			FROM roles r
			WHERE r.code = $2
		`, userID, binding.RoleCode, binding.ScopeType, scopeID, binding.IncludeDescendants)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, ErrNotFound
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListUserRoleBindings(ctx, userID)
}
