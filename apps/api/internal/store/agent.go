package store

import (
	"context"
	"encoding/json"
	"strings"

	"ai-hrms/apps/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

func (s *Store) ListAgentRuns(ctx context.Context, userID string, page, size int) ([]domain.AgentRun, int64, error) {
	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM agent_runs WHERE actor_user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, run_type, status, actor_user_id::text, provider, model, risk_level, summary, created_at
		FROM agent_runs
		WHERE actor_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, size, (page-1)*size)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var runs []domain.AgentRun
	for rows.Next() {
		var run domain.AgentRun
		if err := rows.Scan(&run.ID, &run.RunType, &run.Status, &run.ActorUserID, &run.Provider,
			&run.Model, &run.RiskLevel, &run.Summary, &run.CreatedAt); err != nil {
			return nil, 0, err
		}
		runs = append(runs, run)
	}
	return runs, total, rows.Err()
}

func (s *Store) CreateAgentRun(ctx context.Context, input domain.AgentRun, userID string, delegatedContext map[string]any, prompt string) (*domain.AgentRun, error) {
	if input.RunType == "" {
		input.RunType = "general"
	}
	if input.Provider == "" {
		input.Provider = "fake"
	}
	if input.Model == "" {
		input.Model = "deterministic-v1"
	}
	if input.RiskLevel == "" {
		input.RiskLevel = "low"
	}
	contextJSON, err := json.Marshal(nonNilMap(delegatedContext))
	if err != nil {
		return nil, err
	}
	summary := input.Summary
	if summary == "" {
		summary = "Agent run created with delegated Go context."
	}
	status := "previewed"
	if input.RiskLevel == "high" {
		status = "waiting_human_review"
	} else if input.RiskLevel == "medium" {
		status = "previewed_requires_review"
	}
	var run domain.AgentRun
	err = s.pool.QueryRow(ctx, `
		INSERT INTO agent_runs (run_type, status, actor_user_id, delegated_context, provider, model, risk_level, summary, completed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)
		RETURNING id::text, run_type, status, actor_user_id::text, provider, model, risk_level, summary, created_at
	`, input.RunType, status, userID, contextJSON, input.Provider, input.Model, input.RiskLevel, summary).Scan(
		&run.ID, &run.RunType, &run.Status, &run.ActorUserID, &run.Provider, &run.Model,
		&run.RiskLevel, &run.Summary, &run.CreatedAt)
	if err != nil {
		return nil, err
	}
	if prompt != "" {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO agent_messages (run_id, role, content)
			VALUES ($1,'user',$2), ($1,'assistant',$3)
		`, run.ID, prompt, "已生成可审计的执行记录。涉及写操作时需要预览和确认。")
	}
	if input.RiskLevel != "low" {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO agent_action_plans (run_id, title, risk_level, status, requires_confirmation, plan, rollback_plan)
			VALUES ($1,$2,$3,'draft',true,$4,$5)
		`, run.ID, "需要确认的 Agent 行动计划", input.RiskLevel,
			`[{"step":"preview","description":"先生成预览和影响范围"}]`,
			`[{"step":"compensate","description":"按审计事件回滚或补偿"}]`)
	}
	return &run, nil
}

func (s *Store) AgentRunOwnedBy(ctx context.Context, runID, userID string) (bool, error) {
	if strings.TrimSpace(runID) == "" || strings.TrimSpace(userID) == "" {
		return false, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id::text FROM agent_runs WHERE id = $1 AND actor_user_id = $2`, runID, userID).Scan(&id)
	if err == nil {
		return true, nil
	}
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return false, err
}

func (s *Store) CreateAgentToolCall(ctx context.Context, runID *string, toolName string, arguments map[string]any, accepted bool, message string) error {
	safeArgsJSON, err := json.Marshal(redactMap(arguments))
	if err != nil {
		return err
	}
	status := "rejected"
	if accepted {
		status = "previewed"
	}
	resultJSON, err := json.Marshal(map[string]any{"message": message})
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO agent_tool_calls (run_id, tool_name, arguments, sanitized_arguments, status, result_summary, completed_at)
		VALUES ($1,$2,$3,$4,$5,$6,now())
	`, runID, toolName, safeArgsJSON, safeArgsJSON, status, resultJSON)
	return err
}

func redactMap(value map[string]any) map[string]any {
	out := map[string]any{}
	for key, item := range value {
		lower := strings.ToLower(key)
		if strings.Contains(lower, "idnumber") || strings.Contains(lower, "bank") ||
			strings.Contains(lower, "mobile") || strings.Contains(lower, "email") ||
			strings.Contains(lower, "address") || strings.Contains(lower, "password") {
			out[key] = "[redacted]"
			continue
		}
		out[key] = item
	}
	return out
}
