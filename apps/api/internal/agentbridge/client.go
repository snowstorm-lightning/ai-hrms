package agentbridge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ai-hrms/apps/api/internal/config"
	"ai-hrms/apps/api/internal/domain"
)

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

type EmbeddingResponse struct {
	Provider   string      `json:"provider"`
	Model      string      `json:"model"`
	Dimensions int         `json:"dimensions"`
	Embeddings [][]float64 `json:"embeddings"`
}

type ChatResponse struct {
	Message   string               `json:"message"`
	Provider  string               `json:"provider"`
	Model     string               `json:"model"`
	Citations []domain.RAGCitation `json:"citations"`
}

type ProviderConfig struct {
	ChatProvider               string `json:"chatProvider"`
	DeepSeekChatModel          string `json:"deepseekChatModel"`
	DeepSeekAPIKeyConfigured   bool   `json:"deepseekAPIKeyConfigured"`
	EmbeddingProvider          string `json:"embeddingProvider"`
	EmbeddingModel             string `json:"embeddingModel"`
	EmbeddingDimensions        int    `json:"embeddingDimensions"`
	EmbeddingAPIKeyConfigured  bool   `json:"embeddingAPIKeyConfigured"`
	EmbeddingBaseURLConfigured bool   `json:"embeddingBaseURLConfigured"`
}

func New(ai config.AIConfig) *Client {
	baseURL := strings.TrimRight(strings.TrimSpace(ai.AgentBaseURL), "/")
	timeout := parseTimeout(ai.AgentTimeoutSeconds, 30*time.Second)
	return &Client{
		baseURL: baseURL,
		token:   strings.TrimSpace(ai.AgentServiceToken),
		http:    &http.Client{Timeout: timeout},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.baseURL != ""
}

func (c *Client) Embed(ctx context.Context, texts []string) (*EmbeddingResponse, error) {
	if !c.Enabled() {
		return nil, errors.New("agent boundary is not configured")
	}
	var response EmbeddingResponse
	if err := c.post(ctx, "/embeddings", map[string]any{"texts": texts}, &response); err != nil {
		return nil, err
	}
	if len(response.Embeddings) != len(texts) {
		return nil, errors.New("agent returned mismatched embedding count")
	}
	return &response, nil
}

func (c *Client) Chat(ctx context.Context, message string, citations []domain.RAGCitation) (*ChatResponse, error) {
	if !c.Enabled() {
		return nil, errors.New("agent boundary is not configured")
	}
	var response ChatResponse
	if err := c.post(ctx, "/chat/preview", map[string]any{"message": message, "citations": citations}, &response); err != nil {
		return nil, err
	}
	if strings.TrimSpace(response.Message) == "" {
		return nil, errors.New("agent returned empty chat response")
	}
	return &response, nil
}

func (c *Client) WorkflowDemo(ctx context.Context, goal string, contextItems []string) (map[string]any, error) {
	if !c.Enabled() {
		return nil, errors.New("agent boundary is not configured")
	}
	var response map[string]any
	if err := c.post(ctx, "/workflows/langgraph/demo", map[string]any{"goal": goal, "context": contextItems}, &response); err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) Config(ctx context.Context) (*ProviderConfig, error) {
	if !c.Enabled() {
		return nil, errors.New("agent boundary is not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/config/ai", nil)
	if err != nil {
		return nil, err
	}
	c.authorize(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("agent boundary request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		detail := sanitizedErrorDetail(resp.Body)
		if detail != "" {
			return nil, fmt.Errorf("agent boundary returned status %d: %s", resp.StatusCode, detail)
		}
		return nil, fmt.Errorf("agent boundary returned status %d", resp.StatusCode)
	}
	var response ProviderConfig
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("agent boundary response was invalid: %w", err)
	}
	return &response, nil
}

func (c *Client) post(ctx context.Context, path string, payload any, target any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.authorize(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("agent boundary request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		detail := sanitizedErrorDetail(resp.Body)
		if detail != "" {
			return fmt.Errorf("agent boundary returned status %d: %s", resp.StatusCode, detail)
		}
		return fmt.Errorf("agent boundary returned status %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("agent boundary response was invalid: %w", err)
	}
	return nil
}

func sanitizedErrorDetail(body io.Reader) string {
	limited, err := io.ReadAll(io.LimitReader(body, 512))
	if err != nil {
		return ""
	}
	var payload struct {
		Detail any `json:"detail"`
	}
	if err := json.Unmarshal(limited, &payload); err == nil && payload.Detail != nil {
		return sanitizeDetail(fmt.Sprint(payload.Detail))
	}
	return sanitizeDetail(string(limited))
}

func sanitizeDetail(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "\n", " ")
	value = strings.ReplaceAll(value, "\r", " ")
	if len(value) > 180 {
		value = value[:180]
	}
	return value
}

func (c *Client) authorize(req *http.Request) {
	if c.token != "" {
		req.Header.Set("X-AI-HRMS-Agent-Token", c.token)
	}
}

func parseTimeout(value string, fallback time.Duration) time.Duration {
	seconds, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds * float64(time.Second))
}
