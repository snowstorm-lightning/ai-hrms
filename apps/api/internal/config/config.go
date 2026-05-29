package config

import (
	"os"
	"strings"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	Port           string
	AllowedOrigins []string
	AI             AIConfig
}

type AIConfig struct {
	AgentBaseURL                     string
	AgentServiceToken                string
	AgentTimeoutSeconds              string
	ChatProvider                     string
	DeepSeekBaseURL                  string
	DeepSeekChatModel                string
	DeepSeekReasoningEffort          string
	DeepSeekTimeoutSeconds           string
	EmbeddingProvider                string
	OpenAICompatibleEmbeddingBaseURL string
	OpenAICompatibleEmbeddingModel   string
	RAGEmbeddingDimensions           string
}

func Load() Config {
	return Config{
		DatabaseURL: env("DATABASE_URL", "postgres://ai_hrms:ai_hrms@localhost:55432/ai_hrms?sslmode=disable"),
		JWTSecret:   env("JWT_SECRET", "dev-secret-change-me"),
		Port:        env("API_PORT", "8080"),
		AllowedOrigins: csvEnv("CORS_ALLOWED_ORIGINS", []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		}),
		AI: AIConfig{
			AgentBaseURL:                     env("AGENT_BASE_URL", ""),
			AgentServiceToken:                os.Getenv("AI_HRMS_AGENT_SERVICE_TOKEN"),
			AgentTimeoutSeconds:              env("AGENT_TIMEOUT_SECONDS", "30"),
			ChatProvider:                     env("AI_CHAT_PROVIDER", "fake"),
			DeepSeekBaseURL:                  env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
			DeepSeekChatModel:                env("DEEPSEEK_CHAT_MODEL", "deepseek-v4-flash"),
			DeepSeekReasoningEffort:          env("DEEPSEEK_REASONING_EFFORT", "high"),
			DeepSeekTimeoutSeconds:           env("DEEPSEEK_TIMEOUT_SECONDS", "30"),
			EmbeddingProvider:                env("AI_EMBEDDING_PROVIDER", "fake"),
			OpenAICompatibleEmbeddingBaseURL: env("OPENAI_COMPATIBLE_EMBEDDING_BASE_URL", ""),
			OpenAICompatibleEmbeddingModel:   env("OPENAI_COMPATIBLE_EMBEDDING_MODEL", ""),
			RAGEmbeddingDimensions:           env("RAG_EMBEDDING_DIMENSIONS", "8"),
		},
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func csvEnv(key string, fallback []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	var values []string
	for _, part := range strings.Split(value, ",") {
		part = strings.TrimSpace(part)
		if part != "" {
			values = append(values, part)
		}
	}
	if len(values) == 0 {
		return fallback
	}
	return values
}
