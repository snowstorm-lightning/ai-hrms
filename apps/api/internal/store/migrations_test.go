package store

import "testing"

func TestChecksumSQLIsStable(t *testing.T) {
	got := checksumSQL([]byte("select 1;"))
	want := "354b7196c9ba5fb4b21cf615bb6ec4cd5c07503c34229feef033fc081a8c03f4"
	if got != want {
		t.Fatalf("checksum = %q, want %q", got, want)
	}
}

func TestPublishedMigrationChecksumsAreStable(t *testing.T) {
	want := map[string]string{
		"002_seed.sql":      "5164f1ac2b3293f02b2b9e384ca364c4229c788582d02f19aa36e17b4bdb380c",
		"004_ai_native.sql": "df9cfa085598a34408454dc28d13e015e2f85b8f0df3257d154adcba5a09f4c6",
	}
	for name, checksum := range want {
		sql, err := migrations.ReadFile("migrations/" + name)
		if err != nil {
			t.Fatal(err)
		}
		if got := checksumSQL(sql); got != checksum {
			t.Fatalf("%s checksum = %q, want %q", name, got, checksum)
		}
	}
}

func TestSkipUnappliedMigrationWhenDemoSeedDisabled(t *testing.T) {
	options := MigrationOptions{EnableDemoSeed: false}
	for _, name := range []string{
		"002_seed.sql",
			"003_seed_passwords.sql",
			"004_ai_native.sql",
			"005_real_rag_pgvector.sql",
			"006_sample_company_seed.sql",
	} {
		if !skipUnappliedMigration(name, options) {
			t.Fatalf("%s should be skipped when demo seed is disabled", name)
		}
	}
	if skipUnappliedMigration("007_ai_native_schema_only.sql", options) {
		t.Fatalf("schema-only migration should still run when demo seed is disabled")
	}
	if skipUnappliedMigration("008_system_roles.sql", options) {
		t.Fatalf("system roles migration should still run when demo seed is disabled")
	}
	if skipUnappliedMigration("002_seed.sql", MigrationOptions{EnableDemoSeed: true}) {
		t.Fatalf("demo seed migration should run when demo seed is enabled")
	}
}

func TestKnownSeedMigrationChecksumRepairIsNarrow(t *testing.T) {
	if !knownSeedMigrationChecksum(
		"002_seed.sql",
		"5987732623fed549793af521528ebaa9671a6ca455d28edeb9285a8e7ff10419",
		"5164f1ac2b3293f02b2b9e384ca364c4229c788582d02f19aa36e17b4bdb380c",
	) {
		t.Fatalf("expected known 002 seed checksum to be repairable")
	}
	if !knownSeedMigrationChecksum(
		"004_ai_native.sql",
		"3f357d76e9f84ab64dbe73239c10fa6236b8c208ea6ca44b6d28b15cb57c2c56",
		"df9cfa085598a34408454dc28d13e015e2f85b8f0df3257d154adcba5a09f4c6",
	) {
		t.Fatalf("expected known 004 seed checksum to be repairable")
	}
	if knownSeedMigrationChecksum("001_init.sql", "old", "new") {
		t.Fatalf("schema migrations must not be checksum-repairable")
	}
	if knownSeedMigrationChecksum("002_seed.sql", "unexpected", "5164f1ac2b3293f02b2b9e384ca364c4229c788582d02f19aa36e17b4bdb380c") {
		t.Fatalf("unexpected 002 checksum must not be repairable")
	}
}
