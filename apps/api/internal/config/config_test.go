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

func TestLoadAIConfigDefaults(t *testing.T) {
	t.Setenv("AI_HRMS_ENV", "")
	t.Setenv("AI_HRMS_ENABLE_DEMO_SEED", "")
	t.Setenv("AI_CHAT_PROVIDER", "")
	t.Setenv("DEEPSEEK_BASE_URL", "")
	t.Setenv("DEEPSEEK_CHAT_MODEL", "")
	t.Setenv("DEEPSEEK_REASONING_EFFORT", "")
	t.Setenv("DEEPSEEK_TIMEOUT_SECONDS", "")
	t.Setenv("AGENT_BASE_URL", "")
	t.Setenv("AI_HRMS_AGENT_SERVICE_TOKEN", "")
	t.Setenv("AGENT_TIMEOUT_SECONDS", "")
	t.Setenv("AI_EMBEDDING_PROVIDER", "")
	t.Setenv("RAG_EMBEDDING_DIMENSIONS", "")

	cfg := Load()
	if cfg.AI.ChatProvider != "fake" {
		t.Fatalf("expected fake chat provider, got %q", cfg.AI.ChatProvider)
	}
	if cfg.AI.DeepSeekBaseURL != "https://api.deepseek.com" {
		t.Fatalf("unexpected deepseek base URL: %q", cfg.AI.DeepSeekBaseURL)
	}
	if cfg.AI.DeepSeekChatModel != "deepseek-v4-flash" {
		t.Fatalf("unexpected deepseek chat model: %q", cfg.AI.DeepSeekChatModel)
	}
	if cfg.AI.DeepSeekReasoningEffort != "high" {
		t.Fatalf("unexpected deepseek reasoning effort default")
	}
	if cfg.AI.EmbeddingProvider != "fake" {
		t.Fatalf("expected fake embedding provider, got %q", cfg.AI.EmbeddingProvider)
	}
	if cfg.AI.RAGEmbeddingDimensions != "8" {
		t.Fatalf("expected 8 embedding dimensions, got %q", cfg.AI.RAGEmbeddingDimensions)
	}
	if cfg.AI.AgentBaseURL != "" || cfg.AI.AgentTimeoutSeconds != "30" {
		t.Fatalf("unexpected agent boundary defaults")
	}
	if !cfg.EnableDemoSeed {
		t.Fatalf("development defaults should enable demo seed")
	}
}

func TestLoadAIConfigFromEnv(t *testing.T) {
	t.Setenv("AI_CHAT_PROVIDER", "deepseek")
	t.Setenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
	t.Setenv("DEEPSEEK_CHAT_MODEL", "deepseek-v4-pro")
	t.Setenv("DEEPSEEK_REASONING_EFFORT", "high")
	t.Setenv("DEEPSEEK_TIMEOUT_SECONDS", "45")
	t.Setenv("AGENT_BASE_URL", "http://agent:8090")
	t.Setenv("AI_HRMS_AGENT_SERVICE_TOKEN", "agent-token")
	t.Setenv("AGENT_TIMEOUT_SECONDS", "12")
	t.Setenv("AI_EMBEDDING_PROVIDER", "openai-compatible")
	t.Setenv("OPENAI_COMPATIBLE_EMBEDDING_BASE_URL", "https://embedding.example.com")
	t.Setenv("OPENAI_COMPATIBLE_EMBEDDING_MODEL", "embedding-model")
	t.Setenv("RAG_EMBEDDING_DIMENSIONS", "1536")

	cfg := Load()
	if cfg.AI.ChatProvider != "deepseek" {
		t.Fatalf("deepseek env was not loaded")
	}
	if cfg.AI.DeepSeekChatModel != "deepseek-v4-pro" || cfg.AI.DeepSeekReasoningEffort != "high" {
		t.Fatalf("deepseek model config was not loaded")
	}
	if cfg.AI.EmbeddingProvider != "openai-compatible" || cfg.AI.RAGEmbeddingDimensions != "1536" {
		t.Fatalf("embedding env was not loaded")
	}
	if cfg.AI.AgentBaseURL != "http://agent:8090" || cfg.AI.AgentTimeoutSeconds != "12" {
		t.Fatalf("agent boundary env was not loaded")
	}
}

func TestValidateRejectsDefaultJWTOutsideDevelopment(t *testing.T) {
	cfg := Load()
	cfg.Environment = "staging"
	cfg.JWTSecret = "dev-secret-change-me"

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected default JWT secret to be rejected outside development")
	}
}

func TestValidateAllowsDefaultJWTInDevelopment(t *testing.T) {
	cfg := Load()
	cfg.Environment = "development"
	cfg.JWTSecret = "dev-secret-change-me"

	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected development default JWT secret to be allowed, got %v", err)
	}
}

func TestValidateRejectsShortJWTOutsideDevelopment(t *testing.T) {
	cfg := Load()
	cfg.Environment = "production"
	cfg.JWTSecret = "short-secret"

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected short JWT secret to be rejected outside development")
	}
}

func TestValidateRejectsDemoSeedInProduction(t *testing.T) {
	cfg := Load()
	cfg.Environment = "production"
	cfg.JWTSecret = "0123456789abcdef0123456789abcdef"
	cfg.EnableDemoSeed = true

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected demo seed to be rejected in production")
	}
}
