package app

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"

	"ai-hrms/apps/api/internal/domain"
)

var (
	emailLikePattern   = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	mobileLikePattern  = regexp.MustCompile(`\b1[3-9]\d{9}\b`)
	idLikePattern      = regexp.MustCompile(`\b\d{15}(\d{2}[0-9Xx])?\b`)
	visualSpacePattern = regexp.MustCompile(`\s+`)
)

const (
	executionDeterministic       = "deterministic"
	executionRetrievalOnly       = "retrieval_only"
	executionLLMExplain          = "llm_explain"
	executionSingleAgent         = "single_agent"
	executionMultiAgent          = "multi_agent"
	executionActionPreview       = "action_preview"
	executionHumanReviewRequired = "human_review_required"
)

func decidePromptHarness(message string) domain.HarnessDecision {
	lower := strings.ToLower(strings.TrimSpace(message))
	riskLevel, blockedReason := classifyAIRisk(message)
	routedBy := []string{"rule.intent", "rule.risk"}
	if blockedReason != "" {
		return domain.HarnessDecision{
			Intent:              "high_impact_hr_boundary",
			ExecutionMode:       executionHumanReviewRequired,
			RiskLevel:           riskLevel,
			HumanReviewRequired: true,
			Reason:              "请求触及高影响人事裁决边界，系统只允许解释、证据展示和人工升级。",
			RoutedBy:            append(routedBy, blockedReason),
		}
	}

	action := containsAny(lower, []string{"执行", "创建", "分配", "发送", "更新", "删除", "execute", "create", "assign", "send", "update", "delete"})
	complex := containsAny(lower, []string{"workflow", "工作流", "共同模式", "跨", "多个", "审查", "复核", "audit pattern", "risk pattern"})
	flexible := containsAny(lower, []string{"解释", "生成", "总结", "分析", "建议", "计划", "拆", "why", "explain", "summarize", "analyze", "plan"})
	retrieval := containsAny(lower, []string{"制度", "引用", "资料", "知识", "policy", "citation", "knowledge", "rag"})
	deterministic := containsAny(lower, []string{"数量", "列表", "状态", "查看", "打开", "count", "list", "status", "show"})
	employeeStatusLookup := containsAny(lower, []string{"员工数量", "员工状态", "员工统计", "employee count", "employee status", "headcount"})
	legalEntityLookup := deterministic && containsAny(lower, []string{"法人", "公司", "legal entity", "company"})
	orgUnitLookup := deterministic && containsAny(lower, []string{"组织", "部门", "scope", "org unit", "department"})
	agentRunLookup := deterministic && containsAny(lower, []string{"agent run", "智能体运行", "agent 运行", "运行中心", "工具调用", "tool call"})

	switch {
	case employeeStatusLookup:
		return domain.HarnessDecision{
			Intent:              "employee_status_lookup",
			ExecutionMode:       executionDeterministic,
			RiskLevel:           "low",
			HumanReviewRequired: false,
			Reason:              "员工数量和状态属于结构化 HRMS 查询，由 SQL 按权限 scope 确定性返回，不调用 LLM 或 Agent。",
			RoutedBy:            append(routedBy, "program.sql.employee_status"),
		}
	case legalEntityLookup:
		return domain.HarnessDecision{
			Intent:              "legal_entity_lookup",
			ExecutionMode:       executionDeterministic,
			RiskLevel:           "low",
			HumanReviewRequired: false,
			Reason:              "法人实体、公司列表和状态属于结构化 HRMS 查询，由 SQL 按权限 scope 返回，不调用 LLM、embedding 或 Agent。",
			RoutedBy:            append(routedBy, "program.sql.legal_entities"),
		}
	case orgUnitLookup:
		return domain.HarnessDecision{
			Intent:              "org_unit_lookup",
			ExecutionMode:       executionDeterministic,
			RiskLevel:           "low",
			HumanReviewRequired: false,
			Reason:              "组织单元、部门和 scope 列表属于结构化 HRMS 查询，由 SQL 按权限 scope 返回，不调用 LLM、embedding 或 Agent。",
			RoutedBy:            append(routedBy, "program.sql.org_units"),
		}
	case agentRunLookup:
		return domain.HarnessDecision{
			Intent:              "agent_run_lookup",
			ExecutionMode:       executionDeterministic,
			RiskLevel:           "low",
			HumanReviewRequired: false,
			Reason:              "Agent run 状态和最近运行记录属于结构化运行台查询，由 SQL 读取审计化状态，不调用 LLM 或新的 Agent run。",
			RoutedBy:            append(routedBy, "program.sql.agent_runs"),
		}
	case action:
		return domain.HarnessDecision{
			Intent:              "action_request",
			ExecutionMode:       executionActionPreview,
			RiskLevel:           maxRisk(riskLevel, "medium"),
			UseLLM:              false,
			HumanReviewRequired: true,
			Reason:              "用户意图包含动作请求，先生成工具预览；真实执行只能由后端白名单工具在人确认后完成。",
			RoutedBy:            append(routedBy, "tool.preview.required"),
		}
	case complex:
		return domain.HarnessDecision{
			Intent:              "complex_analysis",
			ExecutionMode:       executionSingleAgent,
			RiskLevel:           maxRisk(riskLevel, "medium"),
			UseLLM:              true,
			UseAgent:            true,
			UseMultiAgent:       containsAny(lower, []string{"多 agent", "multi-agent", "独立审查", "交叉验证"}),
			HumanReviewRequired: true,
			Reason:              "请求需要跨模块综合或多步骤推理，应进入受限 agent run，并保留 trace、verification 和人工交接。",
			RoutedBy:            append(routedBy, "agent.bounded"),
		}
	case flexible:
		return domain.HarnessDecision{
			Intent:              "explain_or_generate",
			ExecutionMode:       executionLLMExplain,
			RiskLevel:           riskLevel,
			UseLLM:              true,
			HumanReviewRequired: riskLevel != "low",
			Reason:              "请求需要自然语言解释、总结或草案生成，适合使用 LLM；上下文、引用、风险和审计仍由系统控制。",
			RoutedBy:            append(routedBy, "llm.value"),
		}
	case retrieval || deterministic:
		return domain.HarnessDecision{
			Intent:              "lookup_or_status",
			ExecutionMode:       executionRetrievalOnly,
			RiskLevel:           riskLevel,
			HumanReviewRequired: false,
			Reason:              "请求可以通过确定性查询、RAG 检索或状态读取完成，不需要调用大模型生成。",
			RoutedBy:            append(routedBy, "program.first"),
		}
	default:
		return domain.HarnessDecision{
			Intent:              "general_explanation",
			ExecutionMode:       executionLLMExplain,
			RiskLevel:           riskLevel,
			UseLLM:              true,
			HumanReviewRequired: riskLevel != "low",
			Reason:              "意图较开放，使用 LLM 生成解释；执行能力仍受工具白名单和人工确认约束。",
			RoutedBy:            append(routedBy, "fallback.llm"),
		}
	}
}

func buildTrustPacket(decision domain.HarnessDecision, confidence float64, citations []domain.RAGCitation, auditStatus string, toolPreview *domain.ToolPreview) domain.TrustPacket {
	if confidence == 0 {
		confidence = 0.72
	}
	return domain.TrustPacket{
		RiskLevel:           decision.RiskLevel,
		Confidence:          confidence,
		HumanReviewRequired: decision.HumanReviewRequired,
		EvidenceCount:       len(citations),
		Citations:           citations,
		ToolPreview:         toolPreview,
		AuditStatus:         auditStatus,
		Reversible:          toolPreview == nil || toolPreview.Reversible,
		PolicyChecks: []string{
			"rbac.scope.checked",
			"high_impact_hr_boundary.checked",
			"tool_schema.preview_first",
			"audit.event.required",
		},
	}
}

func promptAuditSummary(prompt string, decision domain.HarnessDecision) map[string]any {
	trimmed := strings.TrimSpace(prompt)
	sum := sha256.Sum256([]byte(trimmed))
	return map[string]any{
		"promptHash":          hex.EncodeToString(sum[:]),
		"promptPreview":       redactPromptPreview(trimmed),
		"promptLength":        len([]rune(trimmed)),
		"intent":              decision.Intent,
		"executionMode":       decision.ExecutionMode,
		"riskLevel":           decision.RiskLevel,
		"humanReviewRequired": decision.HumanReviewRequired,
	}
}

func redactPromptPreview(value string) string {
	value = emailLikePattern.ReplaceAllString(value, "[email]")
	value = mobileLikePattern.ReplaceAllString(value, "[mobile]")
	value = idLikePattern.ReplaceAllString(value, "[id]")
	runes := []rune(value)
	if len(runes) > 120 {
		value = string(runes[:120]) + "..."
	}
	return value
}

func contextPacketFromCitations(subject string, decision domain.HarnessDecision, citations []domain.RAGCitation) domain.ContextPacket {
	items := make([]domain.ContextItem, 0, len(citations))
	for _, citation := range citations {
		items = append(items, domain.ContextItem{
			Type:       "rag_citation",
			ID:         citation.DocumentID + ":" + citation.ChunkID,
			Label:      citation.Title,
			Summary:    citation.Snippet,
			Source:     "pgvector.rag",
			Provenance: fmt.Sprintf("rag_document/%s chunk/%s", citation.DocumentID, citation.ChunkID),
			Metadata: map[string]any{
				"trustLevel":  citation.TrustLevel,
				"sensitivity": citation.Sensitivity,
				"score":       citation.Score,
			},
		})
	}
	return domain.ContextPacket{
		Intent:      decision.Intent,
		Subject:     subject,
		Items:       items,
		SourceCount: map[string]int{"rag_citation": len(citations)},
		Staleness:   "source_timestamp_preserved",
		Boundary:    "模型只能解释系统提供的资料和引用；没有 citation 时不能生成正式知识建议。",
	}
}

func visualContextPacket(req domain.VisualContextRequest, decision domain.HarnessDecision) domain.ContextPacket {
	refs := collectRefs(req.Regions)
	items := make([]domain.ContextItem, 0, len(refs)+1)
	for _, ref := range refs {
		label := ref.Label
		if label == "" {
			label = ref.Type + ":" + ref.ID
		}
		label = compactVisualText(label, 40)
		items = append(items, domain.ContextItem{
			Type:       ref.Type,
			ID:         ref.ID,
			Label:      label,
			Summary:    "来自页面圈选区域的业务对象引用，后端已按当前 scope 校验可见性。",
			Source:     "visual_selection.dom_ref",
			Provenance: req.Route,
		})
	}
	if len(items) == 0 {
		items = append(items, domContextItems(req)...)
	}
	if len(items) == 0 {
		items = append(items, domain.ContextItem{
			Type:       "screen_region",
			Label:      "页面区域",
			Summary:    routeSummary(req.Route) + " 系统只能使用路由、DOM 摘要和圈选坐标解释，不能读取截图像素。",
			Source:     "visual_selection.rect",
			Provenance: req.Route,
		})
	}
	return domain.ContextPacket{
		Route:       req.Route,
		Intent:      decision.Intent,
		Subject:     strings.TrimSpace(req.Instruction),
		Items:       items,
		SourceCount: map[string]int{"business_ref": len(refs), "dom_node": len(req.DOM), "region": len(req.Regions)},
		Staleness:   "live_page_snapshot",
		Boundary:    "当前 Visual Copilot 不做图片理解；DeepSeek 文本模型只接收经过系统裁剪和校验的业务上下文。",
		Metadata: map[string]any{
			"viewport": req.Viewport,
		},
	}
}

func domContextItems(req domain.VisualContextRequest) []domain.ContextItem {
	items := make([]domain.ContextItem, 0, 4)
	for _, raw := range req.DOM {
		node, ok := raw.(map[string]any)
		if !ok || !boolValue(node["visible"]) || !domNodeIntersectsRegions(node, req.Regions) {
			continue
		}
		kind := stringValue(node["kind"])
		if kind == "" {
			kind = stringValue(node["action"])
		}
		if kind == "" {
			kind = stringValue(node["field"])
		}
		if kind == "" {
			kind = "page_module"
		}
		label := stringValue(node["label"])
		text := stringValue(node["text"])
		if label == "" {
			label = kind
		}
		label = compactVisualText(label, 40)
		summary := compactVisualText(text, 72)
		if summary == "" {
			summary = fmt.Sprintf("页面模块 kind=%s，位于当前圈选区域内。", kind)
		}
		items = append(items, domain.ContextItem{
			Type:       "dom_module",
			Label:      label,
			Summary:    summary,
			Source:     "visual_selection.dom_snapshot_unverified",
			Provenance: req.Route,
			Metadata: map[string]any{
				"kind":             kind,
				"tag":              stringValue(node["tag"]),
				"verifiedEvidence": false,
			},
		})
		if len(items) >= 4 {
			break
		}
	}
	return items
}

func domNodeIntersectsRegions(node map[string]any, regions []domain.ScreenRegion) bool {
	rect, ok := node["rect"].(map[string]any)
	if !ok {
		return false
	}
	x, y := floatValue(rect["x"]), floatValue(rect["y"])
	width, height := floatValue(rect["width"]), floatValue(rect["height"])
	for _, region := range regions {
		rx, ry := floatValue(region.Rect["x"]), floatValue(region.Rect["y"])
		rw, rh := floatValue(region.Rect["width"]), floatValue(region.Rect["height"])
		if x < rx+rw && x+width > rx && y < ry+rh && y+height > ry {
			return true
		}
	}
	return false
}

func routeSummary(route string) string {
	switch {
	case strings.Contains(route, "dashboard"):
		return "这是 AI-HRMS Command Dashboard，用于展示组织数据、知识、学习成长、Agent 运行和审计治理的统一入口。"
	case strings.Contains(route, "ai-command"):
		return "这是 AI 指挥中心，用于生成带证据、风险和人工确认边界的 HR 建议。"
	case strings.Contains(route, "knowledge"):
		return "这是 Knowledge Hub，用于展示可被 AI 引用的受治理知识资料。"
	case strings.Contains(route, "agents"):
		return "这是 Agent Run Center，用于查看工具预览、运行状态和人工确认。"
	case strings.Contains(route, "audit"):
		return "这是 Audit & Evidence，用于追踪建议、工具调用、人工确认和证据链。"
	default:
		return "这是 AI-HRMS 页面的一部分。"
	}
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func compactVisualText(value string, limit int) string {
	value = strings.TrimSpace(visualSpacePattern.ReplaceAllString(value, " "))
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	if limit <= 1 {
		return "…"
	}
	return string(runes[:limit-1]) + "…"
}

func boolValue(value any) bool {
	typed, ok := value.(bool)
	return ok && typed
}

func floatValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case int32:
		return float64(typed)
	default:
		return 0
	}
}

func decideVisualHarness(req domain.VisualContextRequest) domain.HarnessDecision {
	decision := decidePromptHarness(req.Instruction)
	if decision.UseAgent {
		decision.Intent = "visual_agent_upgrade_required"
		decision.ExecutionMode = executionActionPreview
		decision.UseLLM = false
		decision.UseAgent = false
		decision.UseMultiAgent = false
		decision.HumanReviewRequired = true
		decision.Reason = "当前 Visual Copilot 同步接口不直接运行 Agent；复杂请求会生成升级建议，由 Agent Run Center 执行受限 run。"
		decision.RoutedBy = append(decision.RoutedBy, "visual.agent.upgrade.blocked")
	} else if decision.ExecutionMode != executionActionPreview && decision.ExecutionMode != executionHumanReviewRequired {
		decision.Intent = "visual_selection_explain"
		decision.ExecutionMode = executionRetrievalOnly
		decision.UseLLM = false
		decision.UseAgent = false
		decision.UseMultiAgent = false
		decision.Reason = "页面圈选解释优先使用 DOM、业务对象和数据库上下文；只有复杂生成/分析才升级到 LLM 或 agent。"
		decision.RoutedBy = append(decision.RoutedBy, "visual.context.resolver")
	}
	return decision
}

func previewForTool(tool string, args map[string]any, hasWrite bool) domain.ToolPreview {
	spec := toolSpec(tool)
	accepted := spec.riskLevel == "low" && !spec.blocked
	if spec.blocked {
		accepted = false
	}
	decision := "preview_allowed"
	if spec.riskLevel == "medium" {
		decision = "requires_confirmation"
	}
	if spec.blocked || spec.riskLevel == "high" {
		decision = "blocked"
	}
	if hasWrite && spec.riskLevel == "medium" && !spec.blocked {
		decision = "executable_after_confirmation"
	}
	mode := executionDeterministic
	if spec.riskLevel != "low" {
		mode = executionActionPreview
	}
	reason := "确定性工具：由 Go 白名单 handler 校验参数、权限和 scope。"
	if !accepted {
		reason = "该工具涉及写操作或高影响 HR 边界，只能生成预览并请求人工确认。"
	}
	return domain.ToolPreview{
		ToolName:           tool,
		Purpose:            spec.purpose,
		ExecutionMode:      mode,
		RiskLevel:          spec.riskLevel,
		Decision:           decision,
		RequiredCapability: spec.capability,
		Accepted:           accepted,
		PreviewOnly:        !accepted || spec.riskLevel != "low",
		Reversible:         spec.reversible,
		Writes:             spec.writes,
		Arguments:          args,
		Reason:             reason,
	}
}

type toolCatalogSpec struct {
	purpose    string
	riskLevel  string
	capability string
	reversible bool
	blocked    bool
	writes     []string
}

func toolSpec(tool string) toolCatalogSpec {
	switch tool {
	case "list_employees", "get_employee", "list_attendance":
		return toolCatalogSpec{purpose: "只读检索结构化员工或考勤数据", riskLevel: "low", capability: "employee.read", reversible: true}
	case "rag_search":
		return toolCatalogSpec{purpose: "只读检索 scoped RAG 引用", riskLevel: "low", capability: "rag.search", reversible: true}
	case "audit_read":
		return toolCatalogSpec{purpose: "只读检索审计事件", riskLevel: "low", capability: "audit.read", reversible: true}
	case "visual.resolve_selection":
		return toolCatalogSpec{purpose: "解析 Visual Copilot 选区业务对象", riskLevel: "low", capability: "visual_copilot.use", reversible: true}
	case "agent_run_read":
		return toolCatalogSpec{purpose: "只读检索结构化业务数据或 RAG 引用", riskLevel: "low", capability: "agent.execute_read", reversible: true}
	case "learning_recommend":
		return toolCatalogSpec{purpose: "生成学习建议草案，不直接写入员工结果", riskLevel: "low", capability: "learning.view", reversible: true}
	case "learning.assign_plan":
		return toolCatalogSpec{purpose: "为员工分配学习计划", riskLevel: "medium", capability: "learning.manage", reversible: true, writes: []string{"learning_enrollments"}}
	case "mentor.request_review":
		return toolCatalogSpec{purpose: "向导师或 HR 创建人工复核请求", riskLevel: "medium", capability: "agent.execute_write", reversible: true, writes: []string{"agent_action_plans", "audit_events"}}
	case "people_decision_execute", "compensation.update", "promotion.decide", "hiring.reject_candidate":
		return toolCatalogSpec{purpose: "高影响人事裁决或薪酬/录用动作", riskLevel: "high", capability: "agent.execute_write", reversible: false, blocked: true, writes: []string{"people_decisions"}}
	default:
		return toolCatalogSpec{purpose: "未登记工具，必须先进入人工确认", riskLevel: "high", capability: "agent.execute_write", reversible: false, blocked: true}
	}
}

func toolNameForActionPrompt(message string) string {
	lower := strings.ToLower(strings.TrimSpace(message))
	switch {
	case containsAny(lower, []string{"学习", "成长", "课程", "计划", "mission", "learning", "course", "plan"}):
		if containsAny(lower, []string{"分配", "指派", "assign"}) {
			return "learning.assign_plan"
		}
		return "learning_recommend"
	case containsAny(lower, []string{"复核", "确认", "人工", "导师", "mentor", "review"}):
		return "mentor.request_review"
	case containsAny(lower, []string{"录用", "拒绝候选人", "辞退", "解雇", "裁员", "降薪", "调薪", "晋升", "hiring", "terminate", "layoff", "compensation", "promotion"}):
		return "people_decision_execute"
	case containsAny(lower, []string{"审计", "audit"}):
		return "audit_read"
	default:
		return "unregistered.action"
	}
}

func isReadOnlyTool(tool string) bool {
	return toolSpec(tool).riskLevel == "low" && !toolSpec(tool).blocked
}

func collectRefs(regions []domain.ScreenRegion) []domain.BusinessRef {
	seen := map[string]bool{}
	refs := make([]domain.BusinessRef, 0)
	for _, region := range regions {
		for _, ref := range region.BusinessRefs {
			key := ref.Type + ":" + ref.ID
			if key == ":" || seen[key] {
				continue
			}
			seen[key] = true
			refs = append(refs, ref)
		}
	}
	return refs
}

func containsAny(value string, patterns []string) bool {
	for _, pattern := range patterns {
		if strings.Contains(value, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

func tooLong(value string, maxRunes int) bool {
	if maxRunes <= 0 {
		return false
	}
	return len([]rune(strings.TrimSpace(value))) > maxRunes
}

func maxRisk(left, right string) string {
	score := map[string]int{"low": 1, "medium": 2, "high": 3}
	if score[right] > score[left] {
		return right
	}
	if left == "" {
		return right
	}
	return left
}

func formatCounts(counts map[string]int64) string {
	if len(counts) == 0 {
		return "无记录"
	}
	parts := make([]string, 0, len(counts))
	for key, value := range counts {
		if key == "" {
			key = "unknown"
		}
		parts = append(parts, fmt.Sprintf("%s=%d", key, value))
	}
	return strings.Join(parts, "，")
}

func joinLimited(items []string, limit int) string {
	if len(items) == 0 {
		return "无记录"
	}
	if limit <= 0 || len(items) <= limit {
		return strings.Join(items, "、")
	}
	return strings.Join(items[:limit], "、") + fmt.Sprintf(" 等 %d 项", len(items))
}

func visualExplanation(requested string, packet domain.ContextPacket, decision domain.HarnessDecision) string {
	requested = compactVisualText(requested, 80)
	sourceLine := visualExplanationBoundary(packet)
	lines := []string{fmt.Sprintf("你的意图是“%s”。%s", requested, sourceLine)}
	employeeItems := visualItemsByType(packet.Items, "employee", "user")
	if len(employeeItems) > 0 {
		lines = append(lines, visualEmployeeExplanationLines(employeeItems)...)
	}
	visibleItems := visualItemsExceptTypes(packet.Items, "employee", "user")
	if len(visibleItems) > 4 {
		visibleItems = visibleItems[:4]
	}
	for _, item := range visibleItems {
		label := item.Label
		if label == "" {
			label = item.Type + ":" + item.ID
		}
		label = compactVisualText(label, 40)
		summary := compactVisualText(item.Summary, 120)
		switch item.Type {
		case "legal_entity":
			lines = append(lines, fmt.Sprintf("法人实体「%s」：%s 它主要用于确定合同主体、权限 scope、知识资料可见范围和审计责任归属。", label, summary))
		case "org_unit":
			lines = append(lines, fmt.Sprintf("组织单元「%s」：%s 它决定员工、RAG 资料、Agent 工具预览和审计事件的组织范围。", label, summary))
		case "user":
			lines = append(lines, fmt.Sprintf("账号「%s」：%s 它用于登录身份、角色绑定、权限 scope 和审计责任归属，不代表员工绩效或岗位事实。", label, summary))
		case "attendance":
			lines = append(lines, fmt.Sprintf("考勤信号「%s」：%s 该信号只能用于流程解释和人工复核，不得自动形成绩效、淘汰或处罚结论。", label, summary))
		case "message":
			lines = append(lines, fmt.Sprintf("消息证据「%s」：%s 它可作为组织沟通上下文和审计线索，但不能作为无边界训练数据。", label, summary))
		case "dom_module":
			lines = append(lines, fmt.Sprintf("页面模块「%s」：%s", label, summary))
		case "screen_region":
			lines = append(lines, "这个选区没有命中可验证的业务对象；建议圈选具体表格行、卡片、按钮或字段，系统才能读取数据库上下文。")
		default:
			lines = append(lines, fmt.Sprintf("业务对象「%s」：%s", label, summary))
		}
	}
	shown := len(visibleItems) + minInt(len(employeeItems), 8)
	if len(packet.Items) > shown {
		lines = append(lines, fmt.Sprintf("另外还识别到 %d 个上下文对象；详情可展开“上下文证据”查看。", len(packet.Items)-shown))
	}
	if decision.RiskLevel != "low" || decision.HumanReviewRequired {
		if decision.ExecutionMode == executionActionPreview {
			lines = append(lines, "该请求包含动作意图，系统只生成工具预览；真实执行必须经过人工确认、权限复核和审计。")
		} else {
			lines = append(lines, "该解释包含中高风险上下文，系统不会自动执行动作；进入工具预览、人工确认或审计流转前仍需人工复核。")
		}
	}
	return strings.Join(lines, "\n")
}

func visualEmployeeExplanationLines(items []domain.ContextItem) []string {
	lines := []string{fmt.Sprintf("已识别 %d 名员工。以下业务内容按当前主任职法人/组织归属解释，不评价个人绩效、真实产出或任用结论。", len(items))}
	limit := minInt(len(items), 8)
	for _, item := range items[:limit] {
		label := compactVisualText(item.Label, 32)
		position := metadataString(item.Metadata, "position")
		legalEntity := metadataString(item.Metadata, "legalEntity")
		orgUnit := metadataString(item.Metadata, "orgUnit")
		business := metadataString(item.Metadata, "businessExplanation")
		if business == "" {
			business = metadataString(item.Metadata, "legalEntityProfile")
		}
		if business == "" {
			business = compactVisualText(item.Summary, 160)
		}
		lines = append(lines, fmt.Sprintf(
			"%s：岗位=%s，归属=%s / %s；业务内容=%s。",
			label,
			valueOrUnknown(position),
			valueOrUnknown(legalEntity),
			valueOrUnknown(orgUnit),
			valueOrUnknown(compactVisualText(business, 120)),
		))
	}
	if len(items) > limit {
		lines = append(lines, fmt.Sprintf("另有 %d 名员工未在正文逐条展开；可展开“上下文证据”查看完整对象。", len(items)-limit))
	}
	return lines
}

func visualItemsByType(items []domain.ContextItem, types ...string) []domain.ContextItem {
	wanted := map[string]bool{}
	for _, itemType := range types {
		wanted[itemType] = true
	}
	out := make([]domain.ContextItem, 0, len(items))
	for _, item := range items {
		if wanted[item.Type] {
			out = append(out, item)
		}
	}
	return out
}

func visualItemsExceptTypes(items []domain.ContextItem, types ...string) []domain.ContextItem {
	excluded := map[string]bool{}
	for _, itemType := range types {
		excluded[itemType] = true
	}
	out := make([]domain.ContextItem, 0, len(items))
	for _, item := range items {
		if !excluded[item.Type] {
			out = append(out, item)
		}
	}
	return out
}

func metadataString(metadata map[string]any, key string) string {
	if metadata == nil {
		return ""
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func valueOrUnknown(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || value == "<nil>" {
		return "未返回"
	}
	return value
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}

func visualExplanationBoundary(packet domain.ContextPacket) string {
	if packet.SourceCount["postgres_context"] > 0 {
		return "系统已按当前权限从数据库读取业务对象，只解释已返回字段，不补造数据库外事实。"
	}
	if packet.SourceCount["business_ref"] > 0 {
		return "系统已校验圈选区域携带的业务引用，只说明当前用户可见的对象。"
	}
	return "解释仅基于页面模块和选区位置；没有图片理解，也不把页面文字当作已核验业务事实。"
}

func visualSelectedSummary(regionCount int, refLabels []string, packet domain.ContextPacket) string {
	employeeLabels := trustedVisualItemLabels(packet.Items, "employee", "user")
	if len(employeeLabels) > 0 {
		return fmt.Sprintf("已识别 %d 个圈选区域，关联 %d 名员工：%s。业务解释按主任职法人/组织归属生成，不代表个人绩效或真实工作产出判断。", regionCount, len(employeeLabels), strings.Join(compactVisualLabels(employeeLabels), "、"))
	}
	if len(refLabels) > 0 {
		return fmt.Sprintf("已识别 %d 个圈选区域，关联业务对象：%s。", regionCount, strings.Join(compactVisualLabels(refLabels), "、"))
	}
	moduleLabels := make([]string, 0, len(packet.Items))
	for _, item := range packet.Items {
		if item.Type != "dom_module" || item.Label == "" {
			continue
		}
		seen := false
		for _, label := range moduleLabels {
			if label == item.Label {
				seen = true
				break
			}
		}
		if !seen {
			moduleLabels = append(moduleLabels, item.Label)
		}
	}
	if len(moduleLabels) > 0 {
		return fmt.Sprintf("已识别 %d 个圈选区域，命中页面模块：%s。解释基于 DOM 摘要、路由和选区坐标，不读取截图像素。", regionCount, strings.Join(moduleLabels, "、"))
	}
	return fmt.Sprintf("已识别 %d 个圈选区域，未命中具名业务对象或页面模块；系统只能基于页面路由和圈选坐标解释，不读取截图像素。", regionCount)
}

func trustedVisualItemLabels(items []domain.ContextItem, types ...string) []string {
	wanted := map[string]bool{}
	for _, itemType := range types {
		wanted[itemType] = true
	}
	labels := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		if !wanted[item.Type] || item.Label == "" || item.Source != "postgres.business_ref" {
			continue
		}
		key := item.Type + ":" + item.ID + ":" + item.Label
		if seen[key] {
			continue
		}
		seen[key] = true
		labels = append(labels, item.Label)
	}
	return labels
}

func trustedVisualLabels(items []domain.ContextItem) []string {
	labels := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		if item.Label == "" || item.Source != "postgres.business_ref" {
			continue
		}
		key := item.Type + ":" + item.ID + ":" + item.Label
		if seen[key] {
			continue
		}
		seen[key] = true
		labels = append(labels, item.Label)
	}
	return labels
}

func compactVisualLabels(labels []string) []string {
	compacted := make([]string, 0, len(labels))
	for _, label := range labels {
		label = compactVisualText(label, 40)
		if label != "" {
			compacted = append(compacted, label)
		}
	}
	return compacted
}
