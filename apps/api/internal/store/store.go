package store

import (
	"context"
	"embed"
	"errors"
	"sort"
	"strings"

	"ai-hrms/apps/api/internal/rbac"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Store struct {
	pool *pgxpool.Pool
}

type Scope struct {
	Global        bool
	LegalEntityID map[string]bool
	OrgUnitID     map[string]bool
}

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Migrate(ctx context.Context) error {
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	for _, entry := range entries {
		sql, err := migrations.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return err
		}
		if _, err := s.pool.Exec(ctx, string(sql)); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) GetPrincipal(ctx context.Context, userID string) (rbac.Principal, error) {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return rbac.Principal{}, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT r.code, urb.scope_type, urb.scope_id, urb.include_descendants
		FROM user_role_bindings urb
		JOIN roles r ON r.id = urb.role_id
		WHERE urb.user_id = $1
	`, userID)
	if err != nil {
		return rbac.Principal{}, err
	}
	defer rows.Close()

	principal := rbac.Principal{
		UserID:   user.ID,
		Mobile:   user.Mobile,
		Username: user.Username,
	}
	for rows.Next() {
		var binding rbac.Binding
		if err := rows.Scan(&binding.RoleCode, &binding.ScopeType, &binding.ScopeID, &binding.IncludeDescendants); err != nil {
			return rbac.Principal{}, err
		}
		principal.Bindings = append(principal.Bindings, binding)
	}
	if err := rows.Err(); err != nil {
		return rbac.Principal{}, err
	}
	capabilities, err := s.userCapabilities(ctx, userID)
	if err != nil {
		return rbac.Principal{}, err
	}
	principal.Capabilities = capabilities
	return principal, nil
}

func (s *Store) userCapabilities(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT rc.capability_code
		FROM user_role_bindings urb
		JOIN role_capabilities rc ON rc.role_id = urb.role_id
		WHERE urb.user_id = $1
		ORDER BY rc.capability_code
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var capabilities []string
	for rows.Next() {
		var capability string
		if err := rows.Scan(&capability); err != nil {
			return nil, err
		}
		capabilities = append(capabilities, capability)
	}
	return capabilities, rows.Err()
}

func (s *Store) ResolveScope(ctx context.Context, principal rbac.Principal) (Scope, error) {
	scope := Scope{
		Global:        principal.IsGlobal(),
		LegalEntityID: map[string]bool{},
		OrgUnitID:     map[string]bool{},
	}
	if scope.Global {
		return scope, nil
	}

	legalChildren, orgChildren, err := s.scopeTrees(ctx)
	if err != nil {
		return Scope{}, err
	}
	for _, binding := range principal.Bindings {
		if binding.ScopeID == nil {
			continue
		}
		switch binding.ScopeType {
		case rbac.ScopeLegalEntity:
			scope.LegalEntityID[*binding.ScopeID] = true
			if binding.IncludeDescendants {
				addDescendants(scope.LegalEntityID, legalChildren, *binding.ScopeID)
			}
		case rbac.ScopeOrgUnit:
			scope.OrgUnitID[*binding.ScopeID] = true
			if binding.IncludeDescendants {
				addDescendants(scope.OrgUnitID, orgChildren, *binding.ScopeID)
			}
		}
	}
	return scope, nil
}

func (s *Store) scopeTrees(ctx context.Context) (map[string][]string, map[string][]string, error) {
	legalRows, err := s.pool.Query(ctx, `SELECT id::text, parent_id::text FROM legal_entities`)
	if err != nil {
		return nil, nil, err
	}
	defer legalRows.Close()
	legalChildren := map[string][]string{}
	for legalRows.Next() {
		var id string
		var parent *string
		if err := legalRows.Scan(&id, &parent); err != nil {
			return nil, nil, err
		}
		if parent != nil {
			legalChildren[*parent] = append(legalChildren[*parent], id)
		}
	}

	orgRows, err := s.pool.Query(ctx, `SELECT id::text, parent_id::text FROM org_units`)
	if err != nil {
		return nil, nil, err
	}
	defer orgRows.Close()
	orgChildren := map[string][]string{}
	for orgRows.Next() {
		var id string
		var parent *string
		if err := orgRows.Scan(&id, &parent); err != nil {
			return nil, nil, err
		}
		if parent != nil {
			orgChildren[*parent] = append(orgChildren[*parent], id)
		}
	}
	return legalChildren, orgChildren, nil
}

func addDescendants(target map[string]bool, children map[string][]string, id string) {
	for _, childID := range children[id] {
		if target[childID] {
			continue
		}
		target[childID] = true
		addDescendants(target, children, childID)
	}
}

func (scope Scope) ids(table map[string]bool) []string {
	ids := make([]string, 0, len(table))
	for id := range table {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func (scope Scope) legalIDs() []string {
	return scope.ids(scope.LegalEntityID)
}

func (scope Scope) orgIDs() []string {
	return scope.ids(scope.OrgUnitID)
}

func whereIn(column string, ids []string, start int) (string, []any) {
	if len(ids) == 0 {
		return "", nil
	}
	holders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		holders[i] = "$" + itoa(start+i)
		args[i] = id
	}
	return column + " IN (" + strings.Join(holders, ",") + ")", args
}

func itoa(value int) string {
	const digits = "0123456789"
	if value == 0 {
		return "0"
	}
	var out [20]byte
	i := len(out)
	for value > 0 {
		i--
		out[i] = digits[value%10]
		value /= 10
	}
	return string(out[i:])
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

var ErrNotFound = errors.New("not found")
