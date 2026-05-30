package app

import (
	"testing"

	"ai-hrms/apps/api/internal/domain"
)

func TestDecidePromptHarnessProgramFirst(t *testing.T) {
	tests := []struct {
		name          string
		message       string
		wantMode      string
		wantRisk      string
		wantLLM       bool
		wantHumanGate bool
	}{
		{
			name:     "employee status uses deterministic SQL",
			message:  "统计员工数量和状态",
			wantMode: executionDeterministic,
			wantRisk: "low",
		},
		{
			name:          "hiring verdict blocked before model",
			message:       "请判断是否录用这个候选人并给结论",
			wantMode:      executionHumanReviewRequired,
			wantRisk:      "high",
			wantHumanGate: true,
		},
		{
			name:          "layoff and bonus decisions are high impact",
			message:       "根据绩效排名给出裁员和年终奖调整名单",
			wantMode:      executionHumanReviewRequired,
			wantRisk:      "high",
			wantHumanGate: true,
		},
		{
			name:          "protected characteristics are high impact",
			message:       "结合年龄和婚育情况判断员工是否适合晋升",
			wantMode:      executionHumanReviewRequired,
			wantRisk:      "high",
			wantHumanGate: true,
		},
		{
			name:          "workflow uses bounded agent",
			message:       "总结多个审计事件的共同模式并拆成 workflow",
			wantMode:      executionSingleAgent,
			wantRisk:      "medium",
			wantLLM:       true,
			wantHumanGate: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := decidePromptHarness(tt.message)
			if got.ExecutionMode != tt.wantMode {
				t.Fatalf("mode = %q, want %q", got.ExecutionMode, tt.wantMode)
			}
			if got.RiskLevel != tt.wantRisk {
				t.Fatalf("risk = %q, want %q", got.RiskLevel, tt.wantRisk)
			}
			if got.UseLLM != tt.wantLLM {
				t.Fatalf("useLLM = %v, want %v", got.UseLLM, tt.wantLLM)
			}
			if got.HumanReviewRequired != tt.wantHumanGate {
				t.Fatalf("humanReviewRequired = %v, want %v", got.HumanReviewRequired, tt.wantHumanGate)
			}
		})
	}
}

func TestPreviewForToolNeverAcceptsWriteAsExecuted(t *testing.T) {
	medium := previewForTool("learning.assign_plan", map[string]any{"employee": "demo"}, true)
	if medium.Accepted {
		t.Fatalf("medium write tool should not be marked accepted for execution")
	}
	if medium.Decision != "executable_after_confirmation" || !medium.PreviewOnly {
		t.Fatalf("medium decision = %q previewOnly=%v", medium.Decision, medium.PreviewOnly)
	}

	high := previewForTool("people_decision_execute", nil, true)
	if high.Accepted || high.Decision != "blocked" || high.Reversible {
		t.Fatalf("high-impact tool should be blocked and irreversible marker false: %+v", high)
	}
}

func TestVisualHarnessDoesNotClaimLLMForSynchronousExplain(t *testing.T) {
	decision := decideVisualHarness(domain.VisualContextRequest{Instruction: "解释这个 Agent run 的风险"})
	if decision.ExecutionMode != executionRetrievalOnly {
		t.Fatalf("visual explain mode = %q, want retrieval_only", decision.ExecutionMode)
	}
	if decision.UseLLM || decision.UseAgent {
		t.Fatalf("visual synchronous explain should not claim LLM/Agent use: %+v", decision)
	}
}

func TestLocalEmbeddingProviderIsNotTreatedAsExternal(t *testing.T) {
	if localEmbeddingProvider("openai-compatible") {
		t.Fatalf("cloud/openai-compatible provider should remain external")
	}
	if !localEmbeddingProvider("local-openai-compatible") {
		t.Fatalf("local OpenAI-compatible provider should be local")
	}
	if !localEmbeddingProvider("local_cpu") {
		t.Fatalf("underscore local provider alias should be accepted")
	}
}
