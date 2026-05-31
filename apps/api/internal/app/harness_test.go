package app

import (
	"strings"
	"testing"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
	"ai-hrms/apps/api/internal/store"
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
			name:     "legal entity list uses deterministic SQL",
			message:  "查看法人公司列表",
			wantMode: executionDeterministic,
			wantRisk: "low",
		},
		{
			name:     "org unit scope uses deterministic SQL",
			message:  "查看组织 scope 状态",
			wantMode: executionDeterministic,
			wantRisk: "low",
		},
		{
			name:     "agent run status uses deterministic SQL",
			message:  "查看 agent run 状态",
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
			name:          "compensation policy explanation uses RAG instead of hard block",
			message:       "解释奖金制度并给出知识库引用",
			wantMode:      executionLLMExplain,
			wantRisk:      "medium",
			wantLLM:       true,
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
		{
			name:          "write action uses preview without LLM",
			message:       "执行分配新人学习计划",
			wantMode:      executionActionPreview,
			wantRisk:      "medium",
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

func TestToolNameForActionPrompt(t *testing.T) {
	tests := map[string]string{
		"执行分配新人学习计划": "learning.assign_plan",
		"请求导师人工复核":   "mentor.request_review",
		"执行晋升决定":     "people_decision_execute",
		"查看审计事件":     "audit_read",
		"执行未知动作":     "unregistered.action",
	}
	for prompt, want := range tests {
		if got := toolNameForActionPrompt(prompt); got != want {
			t.Fatalf("toolNameForActionPrompt(%q) = %q, want %q", prompt, got, want)
		}
	}
}

func TestToolSpecUsesModuleCapabilities(t *testing.T) {
	tests := map[string]string{
		"list_employees":           "employee.read",
		"rag_search":               "rag.search",
		"audit_read":               "audit.read",
		"visual.resolve_selection": "visual_copilot.use",
		"learning.assign_plan":     "learning.manage",
	}
	for tool, want := range tests {
		if got := toolSpec(tool).capability; got != want {
			t.Fatalf("toolSpec(%q).capability = %q, want %q", tool, got, want)
		}
	}
}

func TestAIChatIntentCapability(t *testing.T) {
	tests := map[string]string{
		"employee_status_lookup": "employee.read",
		"legal_entity_lookup":    "employee.read",
		"org_unit_lookup":        "employee.read",
		"agent_run_lookup":       "agent.execute_read",
		"explain_or_generate":    "",
	}
	for intent, want := range tests {
		if got := aiChatIntentCapability(intent); got != want {
			t.Fatalf("aiChatIntentCapability(%q) = %q, want %q", intent, got, want)
		}
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

func TestVisualHarnessMarksLLMAsScopedCandidateForExplain(t *testing.T) {
	decision := decideVisualHarness(domain.VisualContextRequest{Instruction: "解释这个 Agent run 的风险"})
	if decision.ExecutionMode != executionLLMExplain {
		t.Fatalf("visual explain mode = %q, want llm_explain", decision.ExecutionMode)
	}
	if !decision.UseLLM || decision.UseAgent {
		t.Fatalf("visual explain should be an LLM candidate, not an Agent run: %+v", decision)
	}
	if !containsAny(strings.Join(decision.RoutedBy, ","), []string{"visual.llm.candidate"}) {
		t.Fatalf("visual explain should record scoped LLM candidate route: %+v", decision.RoutedBy)
	}
}

func TestUnsafeExternalProviderTextBlocksWorkforceIdentifiers(t *testing.T) {
	blocked := []string{
		"为企鹅互联网科技有限公司的平台研发新人林晨生成 30 天成长计划",
		"给导师生成下周带教计划",
		"查询员工编号 PG005 的业务内容",
	}
	for _, value := range blocked {
		if !unsafeExternalProviderText(value) {
			t.Fatalf("unsafeExternalProviderText(%q) = false, want true", value)
		}
	}

	allowedPolicyText := "解释新员工 7 天内必须完成哪些事项，并给出引用来源"
	if unsafeExternalProviderText(allowedPolicyText) {
		t.Fatalf("unsafeExternalProviderText(%q) = true, want false", allowedPolicyText)
	}
}

func TestVisualActionIntentPreservesPreviewMode(t *testing.T) {
	for _, intent := range []string{"action_preview", "action_execute", "action_execute_blocked"} {
		if !visualActionIntent(intent) {
			t.Fatalf("visualActionIntent(%q) = false", intent)
		}
	}
	if visualActionIntent("explain_or_act_on_selection") {
		t.Fatalf("explain_or_act_on_selection should not force action preview mode")
	}
}

func TestVisualShouldUseLLMBalancesCostAndQuality(t *testing.T) {
	citations := []domain.RAGCitation{{DocumentID: "doc-1", ChunkID: "chunk-1", Title: "公司业务说明", Snippet: "企鹅互联网科技公司的模拟业务资料。", TrustLevel: "official", Sensitivity: "normal"}}
	packet := domain.ContextPacket{
		Items:       []domain.ContextItem{{Type: "legal_entity", ID: "legal-1", Label: "企鹅互联网科技有限公司", Summary: "Postgres 返回的法人实体摘要。"}},
		SourceCount: map[string]int{"postgres_context": 1, "rag_citation": 1},
	}
	if visualShouldSearchRAG("解释这些公司的业务", packet) {
		t.Fatalf("simple business object explanation should not spend an embedding/RAG query when Postgres context is enough")
	}
	if visualShouldUseLLM("解释这些公司的业务", domain.HarnessDecision{ExecutionMode: executionRetrievalOnly}, packet, citations[:0]) {
		t.Fatalf("business object explanation without RAG citations should not call LLM")
	}
	packet.SourceCount["rag_citation"] = 1
	if !visualShouldSearchRAG("解释这些公司引用了哪些制度", packet) {
		t.Fatalf("citation/policy request should search RAG")
	}
	if visualShouldUseLLM("解释这些公司引用了哪些制度", domain.HarnessDecision{ExecutionMode: executionRetrievalOnly}, packet, citations) {
		t.Fatalf("Visual retrieval-only selection should not be upgraded to LLM just because citations exist")
	}
	if !visualShouldUseLLM("解释这些公司引用了哪些制度", domain.HarnessDecision{ExecutionMode: executionLLMExplain, UseLLM: true}, packet, citations) {
		t.Fatalf("explicit LLM explain decisions with scoped citations should be allowed to use LLM")
	}
	if visualShouldUseLLM("查看公司列表", domain.HarnessDecision{ExecutionMode: executionRetrievalOnly}, packet, citations) {
		t.Fatalf("simple list/status lookup should stay program/retrieval first")
	}
	if visualShouldUseLLM("执行修改公司状态", domain.HarnessDecision{ExecutionMode: executionActionPreview}, packet, citations) {
		t.Fatalf("action preview must not be upgraded to LLM generation")
	}
	if visualShouldUseLLM("解释这些公司的业务", domain.HarnessDecision{ExecutionMode: executionRetrievalOnly}, packet, nil) {
		t.Fatalf("LLM should not run without scoped citations")
	}
}

func TestEnsureRAGDocumentScopesPublishableForNonGlobalActors(t *testing.T) {
	legalID := "00000000-0000-0000-0000-000000000101"
	otherLegalID := "00000000-0000-0000-0000-000000000102"
	orgID := "00000000-0000-0000-0000-000000000201"
	groupHR := "group_hr"
	orgManager := "org_manager"
	actor := rbac.Principal{
		UserID: "00000000-0000-0000-0000-000000000301",
		Bindings: []rbac.Binding{
			{RoleCode: groupHR, ScopeType: rbac.ScopeLegalEntity, ScopeID: strPtr(legalID)},
			{RoleCode: orgManager, ScopeType: rbac.ScopeOrgUnit, ScopeID: strPtr(orgID)},
		},
	}
	scope := store.Scope{
		LegalEntityID: map[string]bool{legalID: true},
		OrgUnitID:     map[string]bool{orgID: true},
	}
	tests := []struct {
		name    string
		scopes  []domain.RAGDocumentScope
		wantErr bool
	}{
		{name: "legal in scope", scopes: []domain.RAGDocumentScope{{ScopeType: "legal_entity", ScopeID: strPtr(legalID)}}},
		{name: "org in scope", scopes: []domain.RAGDocumentScope{{ScopeType: "org_unit", ScopeID: strPtr(orgID)}}},
		{name: "role binding exact scope", scopes: []domain.RAGDocumentScope{{ScopeType: "role", RoleCode: strPtr(groupHR), ScopeID: strPtr(legalID)}}},
		{name: "global rejected", scopes: []domain.RAGDocumentScope{{ScopeType: "global"}}, wantErr: true},
		{name: "legal outside scope rejected", scopes: []domain.RAGDocumentScope{{ScopeType: "legal_entity", ScopeID: strPtr(otherLegalID)}}, wantErr: true},
		{name: "role cross binding rejected", scopes: []domain.RAGDocumentScope{{ScopeType: "role", RoleCode: strPtr(groupHR), ScopeID: strPtr(orgID)}}, wantErr: true},
		{name: "employee scope rejected", scopes: []domain.RAGDocumentScope{{ScopeType: "employee", EmployeeID: strPtr("00000000-0000-0000-0000-000000000401")}}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ensureRAGDocumentScopesPublishable(tt.scopes, scope, actor)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestVisualExplanationDOMOnlyIsBoundedAndCompact(t *testing.T) {
	req := domain.VisualContextRequest{
		Route: "/dashboard",
		DOM: []any{
			map[string]any{
				"visible": true,
				"kind":    "sidebar",
				"label":   "导航菜单 员工 管理 考勤 知识 Agent 审计 学习 成长 组织 设置 报表 导出 帮助 个人中心",
				"text":    strings.Repeat("整页侧栏菜单和页面文本 ", 20),
				"rect":    map[string]any{"x": 0, "y": 0, "width": 200, "height": 400},
			},
		},
		Regions: []domain.ScreenRegion{{Rect: map[string]any{"x": 10, "y": 10, "width": 50, "height": 50}}},
	}
	packet := visualContextPacket(req, domain.HarnessDecision{Intent: "visual_selection_explain"})
	explanation := visualExplanation("解释这个页面模块", packet, domain.HarnessDecision{ExecutionMode: executionRetrievalOnly, RiskLevel: "low", Reason: "页面圈选解释优先使用 DOM、业务对象和数据库上下文。"})

	if !strings.Contains(explanation, "解释仅基于页面模块和选区位置") {
		t.Fatalf("DOM-only explanation should state DOM boundary:\n%s", explanation)
	}
	if !strings.Contains(explanation, "没有图片理解") {
		t.Fatalf("DOM-only explanation should not imply vision analysis:\n%s", explanation)
	}
	if strings.Count(explanation, "整页侧栏菜单和页面文本") > 6 {
		t.Fatalf("DOM explanation leaked too much page text:\n%s", explanation)
	}
	if !strings.Contains(explanation, "…") {
		t.Fatalf("long DOM label/summary should be truncated:\n%s", explanation)
	}
}

func TestVisualExplanationBusinessAndPostgresContextBoundary(t *testing.T) {
	decision := domain.HarnessDecision{ExecutionMode: executionRetrievalOnly, RiskLevel: "medium", Reason: "页面圈选解释优先使用 DOM、业务对象和数据库上下文。"}
	businessPacket := domain.ContextPacket{
		Items:       []domain.ContextItem{{Type: "employee", ID: "e-1", Label: "张三", Summary: "来自页面圈选区域的业务对象引用，后端已按当前 scope 校验可见性。"}},
		SourceCount: map[string]int{"business_ref": 1},
	}
	businessExplanation := visualExplanation("解释这个员工", businessPacket, decision)
	if !strings.Contains(businessExplanation, "后端已按当前 scope 校验可见性") {
		t.Fatalf("business ref explanation should mention scope validation:\n%s", businessExplanation)
	}

	postgresPacket := domain.ContextPacket{
		Items:       []domain.ContextItem{{Type: "employee", ID: "e-1", Label: "张三", Summary: "Postgres 返回的员工档案摘要"}},
		SourceCount: map[string]int{"business_ref": 1, "postgres_context": 1},
	}
	postgresExplanation := visualExplanation("解释这个员工", postgresPacket, decision)
	if !strings.Contains(postgresExplanation, "Postgres") || !strings.Contains(postgresExplanation, "只解释已返回字段") {
		t.Fatalf("Postgres context explanation should state explainability boundary:\n%s", postgresExplanation)
	}
}

func TestVisualExplanationEmployeeBusinessContentIsLocalAndBounded(t *testing.T) {
	packet := domain.ContextPacket{
		Items: []domain.ContextItem{
			{
				Type:    "employee",
				ID:      "e-1",
				Label:   "顾明远",
				Summary: "员工 顾明远，状态=active，主岗位=协同产品研发管理者。",
				Source:  "postgres.business_ref",
				Metadata: map[string]any{
					"position":            "协同产品研发管理者",
					"legalEntity":         "企鹅协同产品",
					"orgUnit":             "协同产品研发部",
					"businessExplanation": "协同办公产品研发、跨团队流程和工作流平台",
				},
			},
			{
				Type:    "employee",
				ID:      "e-2",
				Label:   "沈知衡",
				Summary: "员工 沈知衡，状态=active，主岗位=AI 安全与审计负责人。",
				Source:  "postgres.business_ref",
				Metadata: map[string]any{
					"position":            "AI 安全与审计负责人",
					"legalEntity":         "企鹅风控科技",
					"orgUnit":             "风险策略部",
					"businessExplanation": "内容安全、风控策略、审计证据和 AI 治理能力",
				},
			},
		},
		SourceCount: map[string]int{"business_ref": 2, "postgres_context": 2},
	}
	explanation := visualExplanation("给出这2个人的业务内容", packet, domain.HarnessDecision{ExecutionMode: executionRetrievalOnly, RiskLevel: "medium", HumanReviewRequired: true})
	for _, want := range []string{"已识别 2 名员工", "顾明远", "企鹅协同产品", "协同办公", "沈知衡", "企鹅风控科技", "内容安全", "不评价个人绩效"} {
		if !strings.Contains(explanation, want) {
			t.Fatalf("employee explanation missing %q:\n%s", want, explanation)
		}
	}
	for _, forbidden := range []string{"13000001005", "身份证", "银行卡"} {
		if strings.Contains(explanation, forbidden) {
			t.Fatalf("employee explanation leaked sensitive text %q:\n%s", forbidden, explanation)
		}
	}
}

func TestTrustedVisualLabelsUsesOnlyPostgresBusinessRefs(t *testing.T) {
	items := []domain.ContextItem{
		{Type: "legal_entity", ID: "1", Label: "<client label>", Source: "visual_selection.dom_snapshot_unverified"},
		{Type: "legal_entity", ID: "1", Label: "企鹅企业服务", Source: "postgres.business_ref"},
		{Type: "legal_entity", ID: "1", Label: "企鹅企业服务", Source: "postgres.business_ref"},
	}
	labels := trustedVisualLabels(items)
	if len(labels) != 1 || labels[0] != "企鹅企业服务" {
		t.Fatalf("trusted labels = %#v", labels)
	}
}

func TestVisualExternalQueryLabelsRedactsPeopleContext(t *testing.T) {
	packet := domain.ContextPacket{Items: []domain.ContextItem{
		{Type: "employee", ID: "e-1", Label: "许海川", Summary: "员工许海川，主岗位=高级工程师。", Source: "postgres.business_ref"},
		{Type: "legal_entity", ID: "le-1", Label: "企鹅企业服务", Summary: "法人实体业务摘要。", Source: "postgres.business_ref"},
		{Type: "agent_run", ID: "run-1", Label: "co_growth_coach", Source: "postgres.business_ref"},
	}}
	labels := strings.Join(visualExternalQueryLabels(packet, 6), "\n")
	if strings.Contains(labels, "许海川") || strings.Contains(labels, "高级工程师") {
		t.Fatalf("external RAG query labels should redact employee context: %q", labels)
	}
	if !strings.Contains(labels, "员工对象") || !strings.Contains(labels, "企鹅企业服务") {
		t.Fatalf("external RAG query labels should retain safe object types/business labels: %q", labels)
	}
}

func TestVisualLLMMessageSkipsPeopleAndOrgUnitContext(t *testing.T) {
	packet := domain.ContextPacket{Items: []domain.ContextItem{
		{Type: "employee", ID: "e-1", Label: "许海川", Summary: "员工许海川，主岗位=高级工程师。", Source: "postgres.business_ref"},
		{Type: "org_unit", ID: "ou-1", Label: "AI 平台工程部", Summary: "组织单元，负责人=顾明远。", Source: "postgres.business_ref"},
		{Type: "legal_entity", ID: "le-1", Label: "企鹅企业服务", Summary: "法人实体公开业务摘要。", Source: "postgres.business_ref"},
	}}
	message := visualLLMMessage("解释业务", "/app/employees", packet)
	if strings.Contains(message, "许海川") || strings.Contains(message, "高级工程师") || strings.Contains(message, "顾明远") {
		t.Fatalf("visual LLM message should not include people/org-manager context:\n%s", message)
	}
	if !strings.Contains(message, "企鹅企业服务") {
		t.Fatalf("visual LLM message should retain safe legal entity context:\n%s", message)
	}
}

func TestLocalEmbeddingProviderIsNotTreatedAsExternal(t *testing.T) {
	if localEmbeddingProvider("openai-compatible", "https://api.example.com/v1") {
		t.Fatalf("cloud/openai-compatible provider should remain external")
	}
	if !localEmbeddingProvider("openai-compatible", "http://127.0.0.1:8082/v1") {
		t.Fatalf("OpenAI-compatible provider with local loopback base URL should be local")
	}
	if !localEmbeddingProvider("local-openai-compatible", "") {
		t.Fatalf("local OpenAI-compatible provider should be local")
	}
	if !localEmbeddingProvider("local_cpu", "") {
		t.Fatalf("underscore local provider alias should be accepted")
	}
}

func TestExternalProviderTrustAllowlistFailsClosed(t *testing.T) {
	safe := domain.RAGCitation{Title: "公开制度", Snippet: "流程说明", TrustLevel: "official", Sensitivity: "normal"}
	if !citationSafeForExternalProvider(safe) {
		t.Fatalf("official/normal citation should be allowed")
	}
	unknown := safe
	unknown.TrustLevel = "vendor-beta"
	if citationSafeForExternalProvider(unknown) {
		t.Fatalf("unknown trust level must be rejected before external LLM")
	}
	internal := safe
	internal.TrustLevel = "internal"
	if citationSafeForExternalProvider(internal) {
		t.Fatalf("internal trust level must be rejected before external LLM")
	}
	if err := validateExternalEmbeddingDocument(domain.RAGDocument{Title: "资料", Content: "公开流程", TrustLevel: "vendor-beta", Sensitivity: "normal"}); err == nil {
		t.Fatalf("unknown trust level must reject external embedding")
	}
	if err := validateExternalEmbeddingDocument(domain.RAGDocument{Title: "资料", Content: "公开流程", TrustLevel: "approved", Sensitivity: "public"}); err != nil {
		t.Fatalf("approved/public document should be externally embeddable: %v", err)
	}
}

func strPtr(value string) *string {
	return &value
}
