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
	emailLikePattern       = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	mobileLikePattern      = regexp.MustCompile(`\b1[3-9]\d{9}\b`)
	idLikePattern          = regexp.MustCompile(`\b\d{15}(\d{2}[0-9Xx])?\b`)
	longNumberPattern      = regexp.MustCompile(`\b\d{12,19}\b`)
	employeeNoPattern      = regexp.MustCompile(`(?i)\b(PG|EMP|E)[-_]?\d{3,}\b`)
	demoPersonPattern      = regexp.MustCompile(`林晨|周雨桐|许安宁|顾明远|沈知衡|陈向南|罗启明|许海川`)
	workforcePromptPattern = regexp.MustCompile(`(?i)(为|给|针对|面向)[^，。；\n]{0,32}(员工|新人|导师|候选人|面试者|HRBP|employee|candidate|mentor)`)
	visualSpacePattern     = regexp.MustCompile(`\s+`)
	isolatedCJKPattern     = regexp.MustCompile(`^\p{Han}(?:\s+\p{Han})+$`)
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

const (
	visualIntentIdentify         = "identify_selection"
	visualIntentBusinessExplain  = "business_explain"
	visualIntentModuleExplain    = "module_explain"
	visualIntentFieldExplain     = "field_explain"
	visualIntentAccessDiagnostic = "access_diagnostic"
	visualIntentActionPreview    = "action_preview"
	visualIntentEvidence         = "evidence_lookup"
	visualIntentLayout           = "layout_explain"
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
	selectionText := visualSelectionText(req.Layout)
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
	domItems := domContextItems(req)
	if len(refs) > 0 && len(domItems) > 0 {
		items = mergeContextItems(items, domItems)
	}
	if len(items) == 0 {
		items = append(items, domItems...)
	}
	if selectionText != "" {
		selectionItem := domain.ContextItem{
			Type:       "selected_text",
			Label:      visualSemanticHint(req.Layout),
			Summary:    selectionText,
			Source:     "visual_selection.text",
			Provenance: req.Route,
		}
		items = append([]domain.ContextItem{selectionItem}, items...)
	}
	if len(items) == 0 {
		items = append(items, domain.ContextItem{
			Type:       "screen_region",
			Label:      "页面区域",
			Summary:    routeSummary(req.Route) + " 的页面区域；未命中可验证业务对象，回答会以选区内容和页面上下文为准。",
			Source:     "visual_selection.rect",
			Provenance: req.Route,
		})
	}
	return domain.ContextPacket{
		Route:   req.Route,
		Intent:  decision.Intent,
		Subject: strings.TrimSpace(req.Instruction),
		Items:   items,
		SourceCount: map[string]int{
			"business_ref":  len(refs),
			"dom_node":      len(req.DOM),
			"layout_item":   visualLayoutItemCount(req.Layout),
			"region":        len(req.Regions),
			"selected_text": selectedTextCount(selectionText),
		},
		Staleness: "live_page_snapshot",
		Boundary:  "当前 Visual Copilot 不做图片理解；DeepSeek 文本模型只接收经过系统裁剪和校验的业务上下文。",
		Metadata: map[string]any{
			"viewport": req.Viewport,
			"mode":     req.Mode,
		},
	}
}

func selectedTextCount(value string) int {
	if strings.TrimSpace(value) == "" {
		return 0
	}
	return 1
}

func visualLayoutItemCount(layout map[string]any) int {
	if layout == nil {
		return 0
	}
	items, ok := layout["items"].([]any)
	if !ok {
		return 0
	}
	return len(items)
}

func visualSelectionText(layout map[string]any) string {
	if layout == nil {
		return ""
	}
	return compactVisualText(stringValue(layout["selectionText"]), 360)
}

func visualSemanticHint(layout map[string]any) string {
	if layout == nil {
		return "selected_content"
	}
	hint := strings.TrimSpace(stringValue(layout["semanticHint"]))
	if hint == "" {
		return "selected_content"
	}
	return compactVisualText(hint, 60)
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
		headers := stringSliceValue(node["tableHeaders"])
		cells := tableCellSummary(node["rowCells"])
		if len(headers) > 0 || cells != "" {
			if kind == "" {
				kind = "table-row"
			}
			var parts []string
			if len(headers) > 0 {
				parts = append(parts, "列="+strings.Join(headers, "、"))
			}
			if cells != "" {
				parts = append(parts, "可见字段="+cells)
			} else if summary != "" {
				parts = append(parts, "可见文本="+summary)
			}
			summary = "表格上下文：" + strings.Join(parts, "；")
		}
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
				"page":             stringValue(node["page"]),
				"tableHeaders":     headers,
				"rowCells":         cells,
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

func stringSliceValue(value any) []string {
	values, ok := value.([]any)
	if !ok {
		if typed, ok := value.([]string); ok {
			values = make([]any, 0, len(typed))
			for _, item := range typed {
				values = append(values, item)
			}
		} else {
			return nil
		}
	}
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, item := range values {
		text := compactVisualText(stringValue(item), 28)
		if text == "" || seen[text] {
			continue
		}
		seen[text] = true
		out = append(out, text)
		if len(out) >= 10 {
			break
		}
	}
	return out
}

func tableCellSummary(value any) string {
	values, ok := value.([]any)
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(values))
	for _, item := range values {
		cell, ok := item.(map[string]any)
		if !ok {
			continue
		}
		header := compactVisualText(stringValue(cell["header"]), 18)
		text := compactVisualText(stringValue(cell["text"]), 32)
		if text == "" {
			continue
		}
		if header == "" {
			header = "字段"
		}
		parts = append(parts, header+"="+text)
		if len(parts) >= 8 {
			break
		}
	}
	return strings.Join(parts, "；")
}

func routeSummary(route string) string {
	switch {
	case strings.Contains(route, "dashboard"):
		return "这是 AI-HRMS Command Dashboard，用于展示组织数据、知识、学习成长、Agent 运行和审计治理的统一入口。"
	case strings.Contains(route, "ai-command"):
		return "这是 AI 指挥中心，用于生成带证据、风险和人工确认边界的 HR 建议。"
	case strings.Contains(route, "knowledge"):
		return "这是 Knowledge Hub，用于展示可被 AI 引用的受治理知识资料。"
	case strings.Contains(route, "docs"):
		return "这是 AI-HRMS 文档库，用于阅读受治理资料，并通过 RAG 生成带引用的精准回答。"
	case strings.Contains(route, "agents"):
		return "这是 Agent Run Center，用于查看工具预览、运行状态和人工确认。"
	case strings.Contains(route, "audit"):
		return "这是 Audit & Evidence，用于追踪建议、工具调用、人工确认和证据链。"
	case strings.Contains(route, "settings"):
		return "这是设置页面，用于管理语言、侧边栏宽度、界面密度和 Visual Copilot 默认行为。"
	case strings.Contains(route, "users"):
		return "这是账号与角色治理页，用于维护登录账号、角色绑定、权限 scope 和审计责任归属。"
	case strings.Contains(route, "legal-entities"):
		return "这是法人 scope 页面，用于维护法人实体、地区和合同主体边界。"
	case strings.Contains(route, "org-units"):
		return "这是组织 scope 页面，用于维护组织树、负责人和下级可见范围。"
	case strings.Contains(route, "employees"):
		return "这是员工数据层页面，用于查看当前 scope 内员工和主任职归属。"
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
	if isolatedCJKPattern.MatchString(value) {
		value = strings.ReplaceAll(value, " ", "")
	}
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
	} else if decision.ExecutionMode == executionLLMExplain && decision.UseLLM {
		decision.Intent = "visual_scoped_explanation"
		decision.Reason = "页面解释先由后端 Context Resolver 裁剪上下文，主回答优先由 LLM 基于受控 citation 生成；证据、风险和审计块仍由程序化规则输出。"
		decision.RoutedBy = append(decision.RoutedBy, "visual.llm.candidate")
	} else if decision.ExecutionMode != executionActionPreview && decision.ExecutionMode != executionHumanReviewRequired {
		decision.Intent = "visual_selection_explain"
		decision.ExecutionMode = executionLLMExplain
		decision.UseLLM = true
		decision.UseAgent = false
		decision.UseMultiAgent = false
		decision.Reason = "Visual Copilot 的主回答优先使用 LLM 生成自然解释；上下文裁剪、证据清洗、权限、风险和审计仍由后端规则控制。"
		decision.RoutedBy = append(decision.RoutedBy, "visual.context.resolver", "visual.llm.default")
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
	case "list_employees", "get_employee", "list_attendance", "attendance_realtime_overview":
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
	requested = compactVisualText(strings.TrimSpace(requested), 120)
	intent := classifyVisualQuestion(requested, packet, decision)
	lines := visualPlannedAnswer(intent, requested, packet, decision)
	if len(lines) == 0 {
		lines = []string{"我没有拿到足够的页面语义。请圈选具体表格行、卡片、按钮或字段，再说明你想知道“是谁、是什么、为什么、怎么做或依据在哪里”。"}
	}
	if decision.ExecutionMode == executionActionPreview {
		lines = append(lines, "这类请求只生成工具预览；真实执行必须经过权限复核、人工确认和审计记录。")
	} else if decision.ExecutionMode == executionHumanReviewRequired || decision.RiskLevel == "high" {
		lines = append(lines, "这类问题触及高影响人事边界，系统只能解释依据和风险，不能自动形成录用、晋升、降薪、淘汰或处罚结论。")
	}
	return strings.Join(compactAnswerLines(lines), "\n")
}

func classifyVisualQuestion(requested string, packet domain.ContextPacket, decision domain.HarnessDecision) string {
	lower := strings.ToLower(strings.TrimSpace(requested))
	if decision.ExecutionMode == executionActionPreview || decision.Intent == "action_request" {
		return visualIntentActionPreview
	}
	if visualPacketHasAdminGuide(packet) && containsAny(lower, []string{"为什么", "看不了", "看不到", "无法", "不能", "why", "cannot", "can't", "not see"}) {
		return visualIntentAccessDiagnostic
	}
	if containsAny(lower, []string{"为什么", "看不了", "看不到", "无法", "不能", "没有权限", "why", "cannot", "can't", "not see", "permission"}) {
		return visualIntentAccessDiagnostic
	}
	if containsAny(lower, []string{"点击", "按钮", "提交", "保存", "删除", "新增", "编辑", "权限", "执行", "会做什么", "干嘛", "action", "button", "submit", "save", "delete", "create", "edit"}) {
		return visualIntentActionPreview
	}
	if containsAny(lower, []string{"字段", "这一列", "这列", "列名", "是什么意思", "什么意思", "column", "field"}) {
		return visualIntentFieldExplain
	}
	if containsAny(lower, []string{"引用", "依据", "证据", "来源", "制度", "政策", "参考", "citation", "evidence", "source", "policy"}) {
		return visualIntentEvidence
	}
	if containsAny(lower, []string{"位置", "左边", "右边", "上面", "下面", "布局", "挡住", "重叠", "看不清", "layout", "position", "overlap"}) {
		return visualIntentLayout
	}
	if containsAny(lower, []string{"谁", "哪些人", "这些人", "这几个人", "名单", "哪个", "which", "who"}) {
		return visualIntentIdentify
	}
	if containsAny(lower, []string{"业务内容", "负责什么", "职责", "归属", "scope", "角色", "role", "owner", "responsibility"}) {
		return visualIntentBusinessExplain
	}
	if containsAny(lower, []string{"这是什么", "这部分", "这个页面", "这个模块", "解释", "说明", "what is this", "explain"}) {
		return visualIntentModuleExplain
	}
	if len(visualItemsByType(packet.Items, "user", "employee", "legal_entity", "org_unit", "rag_document", "agent_run", "audit_event", "attendance", "message")) > 0 {
		return visualIntentIdentify
	}
	return visualIntentModuleExplain
}

func visualPlannedAnswer(intent, requested string, packet domain.ContextPacket, decision domain.HarnessDecision) []string {
	switch intent {
	case visualIntentAccessDiagnostic:
		return visualAccessDiagnosticAnswer(packet)
	case visualIntentActionPreview:
		return visualActionAnswer(packet, decision)
	case visualIntentFieldExplain:
		return visualFieldAnswer(packet)
	case visualIntentEvidence:
		return visualEvidenceAnswer(packet)
	case visualIntentLayout:
		return visualLayoutAnswer(packet)
	case visualIntentBusinessExplain:
		return visualBusinessAnswer(packet)
	case visualIntentIdentify:
		return visualIdentifyAnswer(packet)
	default:
		return visualModuleAnswer(packet, requested)
	}
}

func visualIdentifyAnswer(packet domain.ContextPacket) []string {
	users := visualItemsByType(packet.Items, "user")
	employees := visualItemsByType(packet.Items, "employee")
	if len(users) > 0 {
		lines := []string{fmt.Sprintf("这是账号与角色治理中的 %d 个账号：%s。", len(users), strings.Join(itemLabels(users, 12), "、"))}
		if details := accountDetails(users, 8); len(details) > 0 {
			lines = append(lines, details...)
		}
		lines = append(lines, "这些对象表示登录账号和角色绑定，不等同于员工绩效、岗位评价或任用结论。")
		return lines
	}
	if len(employees) > 0 {
		lines := []string{fmt.Sprintf("这是 %d 名员工：%s。", len(employees), strings.Join(itemLabels(employees, 12), "、"))}
		if details := employeeBriefDetails(employees, 6); len(details) > 0 {
			lines = append(lines, details...)
		} else {
			lines = append(lines, "当前只识别到员工身份，没有返回岗位、组织或职责字段；如果需要这些信息，请圈选员工详情或包含组织/岗位列的表格。")
		}
		return lines
	}
	businessItems := visualPrimaryBusinessItems(packet.Items)
	if len(businessItems) > 0 {
		return []string{fmt.Sprintf("这个选区关联 %d 个业务对象：%s。", len(businessItems), strings.Join(itemTypeLabels(businessItems, 10), "、"))}
	}
	return visualModuleAnswer(packet, "")
}

func visualBusinessAnswer(packet domain.ContextPacket) []string {
	users := visualItemsByType(packet.Items, "user")
	employees := visualItemsByType(packet.Items, "employee")
	if len(users) > 0 {
		lines := []string{fmt.Sprintf("这些是账号对象，共 %d 个，主要用于登录、角色绑定、scope 授权和审计归属。", len(users))}
		lines = append(lines, accountDetails(users, 8)...)
		return lines
	}
	if len(employees) > 0 {
		return visualEmployeeExplanationLines(employees)
	}
	items := visualPrimaryBusinessItems(packet.Items)
	if len(items) == 0 {
		return visualModuleAnswer(packet, "")
	}
	lines := []string{fmt.Sprintf("选区关联 %d 个业务对象，主要含义如下。", len(items))}
	for _, item := range items[:minInt(len(items), 6)] {
		lines = append(lines, businessItemLine(item))
	}
	return lines
}

func visualModuleAnswer(packet domain.ContextPacket, requested string) []string {
	if visualPacketHasAdminGuide(packet) {
		return []string{"这部分是管理员指南，覆盖账号维护、角色绑定、法人 scope、组织 scope、RAG 资料发布和高风险审计检查。它只对 group_admin 角色开放。"}
	}
	if modules := visualItemsByType(packet.Items, "dom_module", "screen_region"); len(modules) > 0 {
		lines := make([]string, 0, minInt(len(modules), 4))
		for _, item := range modules[:minInt(len(modules), 4)] {
			label := compactVisualText(item.Label, 40)
			summary := compactVisualText(item.Summary, 160)
			if item.Type == "screen_region" {
				lines = append(lines, "这个选区没有命中具名业务对象；请圈选具体表格行、卡片、按钮或字段，回答会更准确。")
				continue
			}
			lines = append(lines, visualDOMModuleExplanation(label, summary, item.Metadata))
		}
		return lines
	}
	if items := visualPrimaryBusinessItems(packet.Items); len(items) > 0 {
		return visualIdentifyAnswer(packet)
	}
	if requested != "" {
		return []string{fmt.Sprintf("我没有从这块区域拿到足够的业务语义来回答“%s”。请扩大或缩小选区到具体标题、字段、表格行或按钮。", requested)}
	}
	return nil
}

func visualFieldAnswer(packet domain.ContextPacket) []string {
	if rows := visualItemsByType(packet.Items, "dom_module"); len(rows) > 0 {
		for _, row := range rows {
			headers := stringSliceFromMetadata(row.Metadata, "tableHeaders")
			cells := metadataString(row.Metadata, "rowCells")
			if len(headers) == 0 && cells == "" {
				continue
			}
			lines := []string{}
			if len(headers) > 0 {
				lines = append(lines, "这个选区属于表格区域。可见列包括："+strings.Join(headers, "、")+"。")
			}
			if cells != "" {
				lines = append(lines, "当前选中行可见字段："+cells+"。")
			}
			lines = append(lines, "如果你要问某一列，请只圈选表头或该列单元格，我会按字段名解释。")
			return lines
		}
	}
	if users := visualItemsByType(packet.Items, "user"); len(users) > 0 {
		return []string{"当前表格的核心字段是用户名、手机号、角色和启用状态。用户名是登录账号显示名；手机号是登录标识或联系标识；角色决定 capability 与 scope；启用状态表示账号能否登录。"}
	}
	return []string{"我没有识别到明确的字段或列名。请圈选表头、单元格或表单字段。"}
}

func visualAccessDiagnosticAnswer(packet domain.ContextPacket) []string {
	if visualPacketHasAdminGuide(packet) {
		return []string{"看不了这块通常是权限原因：管理员指南只对 group_admin 角色显示。请确认当前账号是否已绑定 group_admin；如果刚调整过角色，重新登录或刷新页面后再试。普通用户不会看到账号、角色、法人 scope、组织 scope 和 RAG 发布等治理入口。"}
	}
	lines := []string{"如果页面区域不可见，优先检查当前账号的角色、scope、登录状态和页面筛选条件。"}
	if labels := itemTypeLabels(visualPrimaryBusinessItems(packet.Items), 6); len(labels) > 0 {
		lines = append(lines, "本次选区关联对象："+strings.Join(labels, "、")+"。若这些对象消失或不可编辑，通常是 scope 或 capability 不覆盖。")
	}
	lines = append(lines, "角色或 scope 刚调整后，需要刷新页面或重新登录，后端才会重新解析权限。")
	return lines
}

func visualActionAnswer(packet domain.ContextPacket, decision domain.HarnessDecision) []string {
	actionItems := visualActionItems(packet.Items)
	if len(actionItems) > 0 {
		lines := []string{fmt.Sprintf("这块区域包含 %d 个可操作入口：%s。", len(actionItems), strings.Join(itemLabels(actionItems, 6), "、"))}
		lines = append(lines, "我可以解释它们的用途和风险，但不会在截图问答里直接执行写操作。")
		return lines
	}
	if users := visualItemsByType(packet.Items, "user"); len(users) > 0 {
		return []string{fmt.Sprintf("如果你要对这 %d 个账号执行编辑、权限变更或禁用操作，系统必须先生成工具预览，再由有权限的人确认。", len(users))}
	}
	if decision.ExecutionMode == executionActionPreview {
		return []string{"这个请求被识别为动作意图。系统会先展示工具预览、影响范围、风险和所需权限，不会直接写入数据。"}
	}
	return []string{"我没有识别到明确按钮或动作。请圈选按钮、菜单项或表单提交区域。"}
}

func visualEvidenceAnswer(packet domain.ContextPacket) []string {
	citations := visualItemsByType(packet.Items, "rag_citation")
	if len(citations) > 0 {
		lines := []string{fmt.Sprintf("已找到 %d 条可引用资料，正文回答应以这些 citation 为准。", len(citations))}
		for _, item := range citations[:minInt(len(citations), 4)] {
			lines = append(lines, fmt.Sprintf("《%s》：%s", compactVisualText(item.Label, 48), compactVisualText(item.Summary, 120)))
		}
		return lines
	}
	if docs := visualItemsByType(packet.Items, "rag_document"); len(docs) > 0 {
		return []string{fmt.Sprintf("选区关联 %d 份知识资料：%s。要确认依据，请打开资料详情或在文档库中用具体问题检索 citation。", len(docs), strings.Join(itemLabels(docs, 6), "、"))}
	}
	return []string{"这次没有命中可引用资料。涉及制度、政策或依据时，应先在文档库/RAG 中检索到 citation，再给正式回答。"}
}

func visualLayoutAnswer(packet domain.ContextPacket) []string {
	lines := []string{"我只能基于 DOM、表格语义和 layout snapshot 判断区域关系，不做未脱敏截图的像素级识别。"}
	if packet.SourceCount["layout_item"] > 0 {
		lines = append(lines, fmt.Sprintf("本次选区带有 %d 个 layout 文本片段，可用于解释相对位置、遮挡和换行问题。", packet.SourceCount["layout_item"]))
	}
	if modules := visualItemsByType(packet.Items, "dom_module"); len(modules) > 0 {
		lines = append(lines, "命中的页面模块："+strings.Join(itemLabels(modules, 5), "、")+"。")
	}
	return lines
}

func visualActionItems(items []domain.ContextItem) []domain.ContextItem {
	out := make([]domain.ContextItem, 0, len(items))
	for _, item := range items {
		kind := strings.ToLower(item.Type + " " + item.Label + " " + metadataString(item.Metadata, "kind"))
		if strings.Contains(kind, "action") || strings.Contains(kind, "button") || strings.Contains(kind, "edit") || strings.Contains(kind, "create") || strings.Contains(kind, "delete") || strings.Contains(kind, "提交") || strings.Contains(kind, "按钮") {
			out = append(out, item)
		}
	}
	return out
}

func visualPrimaryBusinessItems(items []domain.ContextItem) []domain.ContextItem {
	out := make([]domain.ContextItem, 0, len(items))
	for _, item := range items {
		switch item.Type {
		case "user", "employee", "legal_entity", "org_unit", "rag_document", "learning", "learning_signal", "learning_mission", "learning_principle", "growth_evidence", "workflow_node", "agent_run", "audit_event", "attendance", "message":
			out = append(out, item)
		}
	}
	return out
}

func accountDetails(items []domain.ContextItem, limit int) []string {
	lines := make([]string, 0, minInt(len(items), limit))
	for _, item := range items[:minInt(len(items), limit)] {
		roleText := stringSliceFromMetadata(item.Metadata, "roles")
		enabled := metadataBoolText(item.Metadata, "enabled")
		var parts []string
		if len(roleText) > 0 {
			parts = append(parts, "角色="+strings.Join(roleText, "、"))
		}
		if enabled != "" {
			parts = append(parts, "状态="+enabled)
		}
		if len(parts) == 0 {
			lines = append(lines, compactVisualText(item.Label, 40))
			continue
		}
		lines = append(lines, fmt.Sprintf("%s：%s。", compactVisualText(item.Label, 40), strings.Join(parts, "，")))
	}
	return lines
}

func employeeBriefDetails(items []domain.ContextItem, limit int) []string {
	lines := make([]string, 0, minInt(len(items), limit))
	for _, item := range items[:minInt(len(items), limit)] {
		var parts []string
		if value := metadataString(item.Metadata, "position"); usableMetadataValue(value) {
			parts = append(parts, "岗位="+value)
		}
		if value := metadataString(item.Metadata, "orgUnit"); usableMetadataValue(value) {
			parts = append(parts, "组织="+value)
		}
		if value := metadataString(item.Metadata, "legalEntity"); usableMetadataValue(value) {
			parts = append(parts, "法人="+value)
		}
		if len(parts) == 0 {
			continue
		}
		lines = append(lines, fmt.Sprintf("%s：%s。", compactVisualText(item.Label, 40), strings.Join(parts, "，")))
	}
	return lines
}

func businessItemLine(item domain.ContextItem) string {
	label := compactVisualText(item.Label, 48)
	summary := compactVisualText(item.Summary, 160)
	switch item.Type {
	case "legal_entity":
		return fmt.Sprintf("法人实体「%s」：%s", label, summary)
	case "org_unit":
		return fmt.Sprintf("组织单元「%s」：%s", label, summary)
	case "rag_document":
		return fmt.Sprintf("知识资料「%s」：%s", label, summary)
	case "agent_run":
		return fmt.Sprintf("Agent run「%s」：%s", label, summary)
	case "audit_event":
		return fmt.Sprintf("审计事件「%s」：%s", label, summary)
	default:
		return fmt.Sprintf("%s「%s」：%s", visualTypeLabel(item.Type), label, summary)
	}
}

func itemLabels(items []domain.ContextItem, limit int) []string {
	labels := make([]string, 0, minInt(len(items), limit))
	seen := map[string]bool{}
	for _, item := range items {
		label := compactVisualText(item.Label, 40)
		if label == "" || seen[label] {
			continue
		}
		seen[label] = true
		labels = append(labels, label)
		if len(labels) >= limit {
			break
		}
	}
	return labels
}

func itemTypeLabels(items []domain.ContextItem, limit int) []string {
	labels := make([]string, 0, minInt(len(items), limit))
	for _, item := range items {
		label := compactVisualText(item.Label, 36)
		if label == "" {
			continue
		}
		labels = append(labels, visualTypeLabel(item.Type)+"「"+label+"」")
		if len(labels) >= limit {
			break
		}
	}
	return labels
}

func visualTypeLabel(itemType string) string {
	switch itemType {
	case "user":
		return "账号"
	case "employee":
		return "员工"
	case "legal_entity":
		return "法人"
	case "org_unit":
		return "组织"
	case "rag_document":
		return "资料"
	case "agent_run":
		return "Agent 运行"
	case "audit_event":
		return "审计事件"
	case "attendance":
		return "考勤信号"
	case "message":
		return "消息"
	default:
		return "对象"
	}
}

func metadataBoolText(metadata map[string]any, key string) string {
	if metadata == nil {
		return ""
	}
	value, ok := metadata[key]
	if !ok {
		return ""
	}
	typed, ok := value.(bool)
	if !ok {
		return ""
	}
	if typed {
		return "启用"
	}
	return "禁用"
}

func stringSliceFromMetadata(metadata map[string]any, key string) []string {
	if metadata == nil {
		return nil
	}
	return stringSliceValue(metadata[key])
}

func usableMetadataValue(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || value == "<nil>" || value == "未返回" || value == "未分配" || value == "未绑定主岗位" {
		return false
	}
	return true
}

func compactAnswerLines(lines []string) []string {
	out := make([]string, 0, len(lines))
	seen := map[string]bool{}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || seen[line] {
			continue
		}
		seen[line] = true
		out = append(out, line)
	}
	return out
}

func visualSupplementalContextItems(items []domain.ContextItem) []domain.ContextItem {
	out := make([]domain.ContextItem, 0, len(items))
	for _, item := range items {
		if item.Source == "visual_selection.dom_ref" {
			continue
		}
		switch item.Type {
		case "dom_module", "screen_region":
			out = append(out, item)
		}
	}
	return out
}

func mergeContextItems(primary []domain.ContextItem, secondary []domain.ContextItem) []domain.ContextItem {
	out := make([]domain.ContextItem, 0, len(primary)+len(secondary))
	seen := map[string]bool{}
	add := func(item domain.ContextItem) {
		key := item.Source + ":" + item.Type + ":" + item.ID + ":" + item.Label + ":" + item.Summary
		if seen[key] {
			return
		}
		seen[key] = true
		out = append(out, item)
	}
	for _, item := range primary {
		add(item)
	}
	for _, item := range secondary {
		add(item)
	}
	return out
}

func visualPacketHasAdminGuide(packet domain.ContextPacket) bool {
	for _, item := range packet.Items {
		combined := strings.ToLower(item.Type + " " + item.Label + " " + item.Summary + " " + metadataString(item.Metadata, "kind"))
		if strings.Contains(combined, "admin-guide") || strings.Contains(combined, "group_admin") || strings.Contains(combined, "管理员指南") {
			return true
		}
	}
	return false
}

func visualDOMModuleExplanation(label, summary string, metadata map[string]any) string {
	kind := metadataString(metadata, "kind")
	lower := strings.ToLower(kind + " " + label)
	switch {
	case strings.Contains(lower, "admin-guide") || strings.Contains(summary, "group_admin") || strings.Contains(summary, "管理员指南"):
		return "这部分是管理员指南，覆盖账号维护、角色绑定、法人 scope、组织 scope、RAG 资料发布和高风险审计检查。它被设计成只对 group_admin 角色开放，避免把治理配置暴露给无关角色。"
	case strings.Contains(lower, "ai-hrms-command-dashboard"):
		return "这部分是 AI-HRMS 指挥看板首页主区域，用来说明产品定位、输入示例命令，并把用户引导到 AI 指挥中心、信任层和人机工作流。"
	case strings.Contains(lower, "trust-layer-snapshot"):
		return "这部分是信任层快照，用来展示风险级别、置信度、证据数量、工具预览状态、是否需要人工确认和审计状态。"
	case strings.Contains(lower, "human-agent-workflow"):
		return "这部分是人机协作流程，把 Goal、Context、Agent Plan、Tool Preview、Human Review 和 Audit 串成可审计路径。"
	case strings.Contains(lower, "rag-search") || strings.Contains(lower, "docs-rag"):
		return "这部分是 RAG 检索入口。涉及引用、制度依据或资料位置的问题应通过这里检索，并返回 citation、可信等级、敏感级别和审计记录。"
	case strings.Contains(lower, "docs-document"):
		return "这部分是文档库资料卡片，用来阅读资料摘要、查看来源、可信等级、敏感级别和可见 scope。"
	default:
		if summary == "" {
			return fmt.Sprintf("页面模块「%s」：系统识别到这是当前页面的一个可解释模块，但没有拿到可验证业务对象。", label)
		}
		return fmt.Sprintf("页面模块「%s」：%s", label, summary)
	}
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
		var parts []string
		if usableMetadataValue(position) {
			parts = append(parts, "岗位="+position)
		}
		if usableMetadataValue(legalEntity) || usableMetadataValue(orgUnit) {
			parts = append(parts, "归属="+strings.Join(nonEmptyValues(legalEntity, orgUnit), " / "))
		}
		if usableMetadataValue(business) {
			parts = append(parts, "业务内容="+compactVisualText(business, 120))
		}
		if len(parts) == 0 {
			lines = append(lines, fmt.Sprintf("%s：当前只返回了可见员工身份，没有返回岗位、组织或职责字段。", label))
			continue
		}
		lines = append(lines, fmt.Sprintf("%s：%s。", label, strings.Join(parts, "；")))
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

func nonEmptyValues(values ...string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if usableMetadataValue(value) {
			out = append(out, value)
		}
	}
	return out
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
	userLabels := trustedVisualItemLabels(packet.Items, "user")
	if len(userLabels) > 0 {
		return fmt.Sprintf("已识别 %d 个圈选区域，关联 %d 个账号：%s。账号用于登录、角色绑定、scope 授权和审计责任归属。", regionCount, len(userLabels), strings.Join(compactVisualLabels(userLabels), "、"))
	}
	employeeLabels := trustedVisualItemLabels(packet.Items, "employee")
	if len(employeeLabels) > 0 {
		return fmt.Sprintf("已识别 %d 个圈选区域，关联 %d 名员工：%s。业务解释按主职法人/组织归属生成，不代表个人绩效或真实工作产出判断。", regionCount, len(employeeLabels), strings.Join(compactVisualLabels(employeeLabels), "、"))
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
		return fmt.Sprintf("已识别 %d 个圈选区域，命中页面模块：%s。回答会按当前页面可见内容和权限边界解释，不把截图当作已核验业务事实。", regionCount, strings.Join(moduleLabels, "、"))
	}
	return fmt.Sprintf("已识别 %d 个圈选区域，未命中具名业务对象或页面模块；建议圈选具体卡片、表格行、按钮或字段，以便给出更精准的业务解释。", regionCount)
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
