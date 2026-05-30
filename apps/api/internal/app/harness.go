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
	emailLikePattern  = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	mobileLikePattern = regexp.MustCompile(`\b1[3-9]\d{9}\b`)
	idLikePattern     = regexp.MustCompile(`\b\d{15}(\d{2}[0-9Xx])?\b`)
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
	case action:
		return domain.HarnessDecision{
			Intent:              "action_request",
			ExecutionMode:       executionActionPreview,
			RiskLevel:           maxRisk(riskLevel, "medium"),
			UseLLM:              flexible,
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
		summary := text
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
	case "list_employees", "get_employee", "list_attendance", "rag_search", "audit_read", "visual.resolve_selection":
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

func visualExplanation(requested string, packet domain.ContextPacket, decision domain.HarnessDecision) string {
	lines := []string{fmt.Sprintf("你的意图是“%s”。系统已把圈选区域解析为 %d 个上下文对象。", requested, len(packet.Items))}
	for _, item := range packet.Items {
		label := item.Label
		if label == "" {
			label = item.Type + ":" + item.ID
		}
		switch item.Type {
		case "dom_module":
			lines = append(lines, fmt.Sprintf("你圈选的是页面模块「%s」：%s 来源=%s。", label, item.Summary, item.Source))
		case "screen_region":
			lines = append(lines, fmt.Sprintf("该区域没有业务 ID，但位于「%s」：%s", label, item.Summary))
		default:
			lines = append(lines, fmt.Sprintf("%s：%s 来源=%s。", label, item.Summary, item.Source))
		}
	}
	lines = append(lines, fmt.Sprintf("当前执行路由=%s，风险=%s。%s", decision.ExecutionMode, decision.RiskLevel, decision.Reason))
	lines = append(lines, "如果你要求修改数据，系统只会生成工具预览；真实执行必须经过人工确认、权限复核和审计。")
	return strings.Join(lines, "\n")
}

func visualSelectedSummary(regionCount int, refLabels []string, packet domain.ContextPacket) string {
	if len(refLabels) > 0 {
		return fmt.Sprintf("已识别 %d 个圈选区域，关联业务对象：%s。", regionCount, strings.Join(refLabels, "、"))
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
