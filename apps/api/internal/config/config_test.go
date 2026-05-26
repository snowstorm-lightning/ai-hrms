package config

import "testing"

func TestLoadDefaultAllowedOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg := Load()
	want := []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	if len(cfg.AllowedOrigins) != len(want) {
		t.Fatalf("expected %d default origins, got %d", len(want), len(cfg.AllowedOrigins))
	}
	for i := range want {
		if cfg.AllowedOrigins[i] != want[i] {
			t.Fatalf("origin %d: expected %q, got %q", i, want[i], cfg.AllowedOrigins[i])
		}
	}
}

func TestLoadAllowedOriginsFromCSV(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", " https://hrms.example.com, http://localhost:5173 ,, ")

	cfg := Load()
	want := []string{"https://hrms.example.com", "http://localhost:5173"}
	if len(cfg.AllowedOrigins) != len(want) {
		t.Fatalf("expected %d origins, got %d", len(want), len(cfg.AllowedOrigins))
	}
	for i := range want {
		if cfg.AllowedOrigins[i] != want[i] {
			t.Fatalf("origin %d: expected %q, got %q", i, want[i], cfg.AllowedOrigins[i])
		}
	}
}
