package store

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
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

type MigrationOptions struct {
	EnableDemoSeed bool
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

func (s *Store) Migrate(ctx context.Context, options MigrationOptions) error {
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	applied, err := s.prepareMigrationLedger(ctx, entries, options)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		sql, err := migrations.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		checksum := checksumSQL(sql)
		if existing, ok := applied[name]; ok {
			if existing != checksum {
				repaired, err := s.repairKnownSeedChecksum(ctx, name, existing, checksum)
				if err != nil {
					return err
				}
				if !repaired {
					return fmt.Errorf("migration %s checksum changed after it was applied", name)
				}
				applied[name] = checksum
			}
			continue
		}
		if skipUnappliedMigration(name, options) {
			continue
		}
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO schema_migrations (name, checksum)
			VALUES ($1, $2)
		`, name, checksum); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		applied[name] = checksum
	}
	return nil
}

func (s *Store) prepareMigrationLedger(ctx context.Context, entries []fs.DirEntry, options MigrationOptions) (map[string]string, error) {
	if _, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name text PRIMARY KEY,
			checksum text NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT now()
		)
	`); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `SELECT name, checksum FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	applied := map[string]string{}
	for rows.Next() {
		var name, checksum string
		if err := rows.Scan(&name, &checksum); err != nil {
			return nil, err
		}
		applied[name] = checksum
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(applied) > 0 {
		return applied, nil
	}
	initialized, err := s.schemaAlreadyInitialized(ctx)
	if err != nil || !initialized {
		return applied, err
	}
	for _, entry := range entries {
		if entry.IsDir() || skipUnappliedMigration(entry.Name(), options) {
			continue
		}
		satisfied, err := s.migrationAlreadySatisfied(ctx, entry.Name())
		if err != nil {
			return nil, err
		}
		if !satisfied {
			continue
		}
		sql, err := migrations.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return nil, err
		}
		checksum := checksumSQL(sql)
		if _, err := s.pool.Exec(ctx, `
			INSERT INTO schema_migrations (name, checksum)
			VALUES ($1, $2)
			ON CONFLICT (name) DO NOTHING
		`, entry.Name(), checksum); err != nil {
			return nil, err
		}
		applied[entry.Name()] = checksum
	}
	return applied, nil
}

func (s *Store) schemaAlreadyInitialized(ctx context.Context) (bool, error) {
	var initialized bool
	err := s.pool.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&initialized)
	return initialized, err
}

func skipUnappliedMigration(name string, options MigrationOptions) bool {
	if options.EnableDemoSeed {
		return false
	}
	return name == "002_seed.sql" ||
		name == "003_seed_passwords.sql" ||
		name == "004_ai_native.sql" ||
		name == "005_real_rag_pgvector.sql" ||
		name == "006_penguin_company_seed.sql"
}

func (s *Store) repairKnownSeedChecksum(ctx context.Context, name, existing, current string) (bool, error) {
	if !knownSeedMigrationChecksum(name, existing, current) {
		return false, nil
	}
	satisfied, err := s.migrationAlreadySatisfied(ctx, name)
	if err != nil || !satisfied {
		return false, err
	}
	_, err = s.pool.Exec(ctx, `UPDATE schema_migrations SET checksum = $1 WHERE name = $2`, current, name)
	return err == nil, err
}

func knownSeedMigrationChecksum(name, existing, current string) bool {
	// During the AI-HRMS demo-data pass, two seed migrations briefly carried
	// Penguin sample copy before the data was moved to append-only migration 006.
	// Accept only those known pre-release checksums and repair the ledger back to
	// the immutable seed file checksum after confirming the schema/data exists.
	switch name {
	case "002_seed.sql":
		return current == "5164f1ac2b3293f02b2b9e384ca364c4229c788582d02f19aa36e17b4bdb380c" &&
			existing == "5987732623fed549793af521528ebaa9671a6ca455d28edeb9285a8e7ff10419"
	case "004_ai_native.sql":
		return current == "df9cfa085598a34408454dc28d13e015e2f85b8f0df3257d154adcba5a09f4c6" &&
			existing == "3f357d76e9f84ab64dbe73239c10fa6236b8c208ea6ca44b6d28b15cb57c2c56"
	default:
		return false
	}
}

func (s *Store) migrationAlreadySatisfied(ctx context.Context, name string) (bool, error) {
	switch name {
	case "001_init.sql":
		return s.tableExists(ctx, "users")
	case "002_seed.sql", "003_seed_passwords.sql":
		return s.rowExists(ctx, "SELECT EXISTS (SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000301')")
	case "004_ai_native.sql":
		return s.tableExists(ctx, "visual_copilot_events")
	case "005_real_rag_pgvector.sql":
		return s.ragEmbeddingIsUnconstrained(ctx)
	case "006_penguin_company_seed.sql":
		return s.rowExists(ctx, "SELECT EXISTS (SELECT 1 FROM legal_entities WHERE id = '00000000-0000-0000-0000-000000000105')")
	case "007_ai_native_schema_only.sql":
		events, err := s.tableExists(ctx, "visual_copilot_events")
		if err != nil || !events {
			return events, err
		}
		return s.ragEmbeddingIsUnconstrained(ctx)
	default:
		return false, nil
	}
}

func (s *Store) tableExists(ctx context.Context, table string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT to_regclass($1) IS NOT NULL`, "public."+table).Scan(&exists)
	return exists, err
}

func (s *Store) rowExists(ctx context.Context, query string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, query).Scan(&exists)
	return exists, err
}

func (s *Store) ragEmbeddingIsUnconstrained(ctx context.Context) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE((
			SELECT a.atttypmod = -1
			FROM pg_attribute a
			WHERE a.attrelid = to_regclass('public.rag_embeddings')
			  AND a.attname = 'embedding'
		), false)
	`).Scan(&ok)
	return ok, err
}

func checksumSQL(sql []byte) string {
	sum := sha256.Sum256(sql)
	return hex.EncodeToString(sum[:])
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
