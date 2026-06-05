package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
)

func (s *Store) BusinessRefVisible(ctx context.Context, scope Scope, actor rbac.Principal, ref domain.BusinessRef) (bool, error) {
	if ref.ID == "" || ref.Type == "" {
		return false, nil
	}
	if capability := visualBusinessRefCapability(ref.Type); capability != "" && !actor.HasCapability(capability) {
		return false, nil
	}
	switch ref.Type {
	case "employee":
		_, err := s.GetEmployee(ctx, scope, ref.ID)
		if err == nil {
			return true, nil
		}
		if err == ErrNotFound {
			return false, nil
		}
		return false, err
	case "user":
		if !actor.IsGlobal() {
			return false, nil
		}
		_, err := s.GetUser(ctx, ref.ID)
		if err == nil {
			return true, nil
		}
		if err == ErrNotFound {
			return false, nil
		}
		return false, err
	case "legal_entity":
		items, err := s.ListLegalEntities(ctx, scope)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "org_unit":
		items, err := s.ListOrgUnits(ctx, scope)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "rag_document":
		doc, err := s.GetRAGDocument(ctx, scope, actor, ref.ID)
		if err == nil && doc != nil {
			return true, nil
		}
		if err == ErrNotFound {
			return false, nil
		}
		return false, err
	case "attendance":
		items, _, err := s.ListAttendance(ctx, scope, 1, 500)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "message":
		return s.messageVisible(ctx, scope, ref.ID)
	case "learning_signal", "learning_mission", "learning_principle", "growth_evidence", "workflow_node":
		return strings.TrimSpace(ref.Label) != "", nil
	case "learning":
		items, _, err := s.ListLearningCourses(ctx, scope, 1, 100)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "agent_run", "audit_event":
		if ref.Type == "agent_run" {
			var actorUserID *string
			err := s.pool.QueryRow(ctx, `SELECT actor_user_id::text FROM agent_runs WHERE id = $1`, ref.ID).Scan(&actorUserID)
			if err != nil {
				return false, nil
			}
			return scope.Global || (actorUserID != nil && *actorUserID == actor.UserID), nil
		}
		var actorUserID *string
		var scopeType string
		var scopeID *string
		err := s.pool.QueryRow(ctx, `SELECT actor_user_id::text, scope_type, scope_id::text FROM audit_events WHERE id = $1`, ref.ID).Scan(&actorUserID, &scopeType, &scopeID)
		if err != nil {
			return false, nil
		}
		return scope.Global || (actorUserID != nil && *actorUserID == actor.UserID) || auditScopeVisible(scope, scopeType, scopeID), nil
	default:
		return false, nil
	}
}

func auditScopeVisible(scope Scope, scopeType string, scopeID *string) bool {
	if scopeID == nil {
		return scopeType == "global"
	}
	switch scopeType {
	case "legal_entity":
		return containsString(scope.legalIDs(), *scopeID)
	case "org_unit":
		return containsString(scope.orgIDs(), *scopeID)
	default:
		return false
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func legalEntityBusinessProfile(item domain.LegalEntity) string {
	value := strings.ToLower(item.Code + " " + item.Name + " " + item.LegalName)
	switch {
	case strings.Contains(value, "enterprise") || strings.Contains(value, "企业服务"):
		return "面向企业客户的协作方案、交付实施、客户成功和培训支持"
	case strings.Contains(value, "collab") || strings.Contains(value, "协同"):
		return "协同办公、产品研发和跨团队工作流平台"
	case strings.Contains(value, "risk") || strings.Contains(value, "风控"):
		return "内容安全、风控策略、AI 治理和审计能力"
	case strings.Contains(value, "growth") || strings.Contains(value, "增长"):
		return "增长算法、用户运营和数据驱动的业务实验"
	case strings.Contains(value, "group") || strings.Contains(value, "集团"):
		return "集团总部与 AI 平台底座，承载统一 HR、知识治理和 Agent 协作规范"
	default:
		return "模拟互联网科技公司下的业务或职能法人，用于权限 scope、合同边界和审计归属"
	}
}

func orgUnitBusinessProfile(item domain.OrgUnit) string {
	value := strings.ToLower(item.Code + " " + item.Name + " " + item.Type)
	switch {
	case strings.Contains(value, "group-hr") || strings.Contains(value, "人力资源"):
		return "集团 HR 共享能力、组织制度、人才发展和人机协作治理"
	case strings.Contains(value, "ai-platform") || strings.Contains(value, "平台工程"):
		return "AI 平台底座、Agent 工程能力、内部工具链和安全工程实践"
	case strings.Contains(value, "ai-gov") || strings.Contains(value, "安全与治理"):
		return "AI 安全评审、风险策略、审计规范和人审流程"
	case strings.Contains(value, "collab") || strings.Contains(value, "协同"):
		return "协同办公产品研发、跨团队流程和工作流平台"
	case strings.Contains(value, "enterprise") || strings.Contains(value, "企业服务"):
		return "企业客户交付、客户成功、实施支持和培训服务"
	case strings.Contains(value, "growth") || strings.Contains(value, "增长"):
		return "增长策略、用户运营、实验分析和数据驱动迭代"
	case strings.Contains(value, "risk") || strings.Contains(value, "风险"):
		return "内容安全、风控策略、审计证据和 AI 治理能力"
	default:
		return "模拟公司中的组织职责单元，用于限定人员归属、资料可见性、Agent 授权和审计范围"
	}
}

func coGrowthVisualSummary(objectType, label string) string {
	label = valueOrDefault(label, "Co-Growth 对象")
	switch objectType {
	case "learning_signal":
		return fmt.Sprintf("成长信号「%s」来自 Co-Growth Engine，只用于学习辅导、证据充分度和团队趋势分析，不作为个人惩罚或任用依据。", label)
	case "learning_mission":
		return fmt.Sprintf("学习 mission「%s」把 AI 原理学习嵌入模拟工作任务；输出需要人工复盘并沉淀成长证据。", label)
	case "learning_principle":
		return fmt.Sprintf("AI 原理卡「%s」用于解释模型能力、限制和验证方式，适合进入学习路径和 work journal。", label)
	case "growth_evidence":
		return fmt.Sprintf("成长证据「%s」用于记录 prompt、上下文、AI 输出、人类修订、验证和复盘；证据可审计但不等于绩效裁决。", label)
	case "workflow_node":
		return fmt.Sprintf("Workflow 节点「%s」描述 Agent 协作步骤、输入输出和工具边界；高风险步骤必须 human-in-the-loop。", label)
	default:
		return fmt.Sprintf("Co-Growth 对象「%s」属于 AI-HRMS 成长引擎上下文，解释必须保留学习、证据和治理边界。", label)
	}
}

func (s *Store) ResolveBusinessRefs(ctx context.Context, scope Scope, actor rbac.Principal, refs []domain.BusinessRef) ([]domain.ContextItem, error) {
	items := make([]domain.ContextItem, 0, len(refs))
	for _, ref := range refs {
		if capability := visualBusinessRefCapability(ref.Type); capability != "" && !actor.HasCapability(capability) {
			continue
		}
		item, ok, err := s.resolveBusinessRef(ctx, scope, actor, ref)
		if err != nil {
			return nil, err
		}
		if ok {
			items = append(items, item)
		}
	}
	return items, nil
}

func visualBusinessRefCapability(refType string) string {
	switch refType {
	case "employee", "user", "legal_entity", "org_unit":
		return "employee.read"
	case "rag_document":
		return "rag.search"
	case "learning":
		return "learning.view"
	case "learning_signal", "learning_mission", "learning_principle", "growth_evidence", "workflow_node":
		return "learning.view"
	case "agent_run":
		return "agent.execute_read"
	case "audit_event":
		return "audit.read"
	default:
		return ""
	}
}

func (s *Store) resolveBusinessRef(ctx context.Context, scope Scope, actor rbac.Principal, ref domain.BusinessRef) (domain.ContextItem, bool, error) {
	label := ref.Label
	if label == "" {
		label = ref.Type + ":" + ref.ID
	}
	base := domain.ContextItem{
		Type:       ref.Type,
		ID:         ref.ID,
		Label:      label,
		Source:     "postgres.business_ref",
		Provenance: ref.Type + "/" + ref.ID,
	}
	switch ref.Type {
	case "employee":
		employee, err := s.GetEmployee(ctx, scope, ref.ID)
		if err != nil {
			if err == ErrNotFound {
				return base, false, nil
			}
			return base, false, err
		}
		position := "未绑定主岗位"
		orgUnitName := ""
		orgUnitProfile := ""
		legalEntityName := ""
		legalEntityProfile := ""
		if employee.PrimaryAssignment != nil {
			if strings.TrimSpace(employee.PrimaryAssignment.PositionTitle) != "" {
				position = employee.PrimaryAssignment.PositionTitle
			}
			if employee.PrimaryAssignment.OrgUnitName != nil {
				orgUnitName = *employee.PrimaryAssignment.OrgUnitName
			}
			if employee.PrimaryAssignment.LegalEntityName != nil {
				legalEntityName = *employee.PrimaryAssignment.LegalEntityName
			}
			if employee.PrimaryAssignment.LegalEntityID != nil {
				name, profile, err := s.legalEntityBusinessContext(ctx, scope, *employee.PrimaryAssignment.LegalEntityID)
				if err != nil {
					return base, false, err
				}
				if legalEntityName == "" {
					legalEntityName = name
				}
				legalEntityProfile = profile
			}
			if employee.PrimaryAssignment.OrgUnitID != nil {
				name, profile, err := s.orgUnitBusinessContext(ctx, scope, *employee.PrimaryAssignment.OrgUnitID)
				if err != nil {
					return base, false, err
				}
				if orgUnitName == "" {
					orgUnitName = name
				}
				orgUnitProfile = profile
			}
		}
		if legalEntityProfile == "" && legalEntityName != "" {
			legalEntityProfile = "按主任职法人归属确定业务边界；当前 scope 未返回更细的业务画像"
		}
		if orgUnitProfile == "" && orgUnitName != "" {
			orgUnitProfile = "按主任职组织归属确定日常协作范围；当前 scope 未返回更细的组织职责画像"
		}
		base.Label = employee.Name
		base.Summary = fmt.Sprintf(
			"员工 %s，状态=%s，主岗位=%s，主任职法人=%s，主任职组织=%s；法人业务定位=%s；组织职责=%s。",
			employee.Name,
			valueOrDefault(employee.Status, "unknown"),
			position,
			valueOrDefault(legalEntityName, "未分配"),
			valueOrDefault(orgUnitName, "未分配"),
			valueOrDefault(legalEntityProfile, "无法仅凭当前字段推断业务定位"),
			valueOrDefault(orgUnitProfile, "无法仅凭当前字段推断组织职责"),
		)
		base.Metadata = map[string]any{
			"employeeNo":          employee.EmployeeNo,
			"status":              employee.Status,
			"position":            position,
			"legalEntity":         legalEntityName,
			"legalEntityProfile":  legalEntityProfile,
			"orgUnit":             orgUnitName,
			"orgUnitProfile":      orgUnitProfile,
			"businessExplanation": valueOrDefault(orgUnitProfile, legalEntityProfile),
		}
		return base, true, nil
	case "user":
		if !actor.IsGlobal() {
			return base, false, nil
		}
		user, err := s.GetUser(ctx, ref.ID)
		if err != nil {
			if err == ErrNotFound {
				return base, false, nil
			}
			return base, false, err
		}
		base.Label = user.Username
		base.Summary = fmt.Sprintf("账号 %s，启用状态=%d，角色=%s。账号用于登录、权限绑定、RAG scope、Agent tool preview 和审计责任归属。", user.Username, user.EnableState, strings.Join(user.Roles, "、"))
		base.Metadata = map[string]any{"roles": user.Roles, "enabled": user.EnableState == 1}
		return base, true, nil
	case "legal_entity":
		items, err := s.ListLegalEntities(ctx, scope)
		if err != nil {
			return base, false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				base.Label = item.Name
				base.Summary = fmt.Sprintf("法人实体 %s，区域=%s，状态=%s；业务定位=%s。", item.Name, item.Area, item.Status, legalEntityBusinessProfile(item))
				base.Metadata = map[string]any{"code": item.Code, "businessProfile": legalEntityBusinessProfile(item)}
				return base, true, nil
			}
		}
	case "org_unit":
		items, err := s.ListOrgUnits(ctx, scope)
		if err != nil {
			return base, false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				base.Label = item.Name
				base.Summary = fmt.Sprintf("组织单元 %s，类型=%s，负责人=%s。", item.Name, item.Type, item.ManagerName)
				base.Metadata = map[string]any{"code": item.Code}
				return base, true, nil
			}
		}
	case "rag_document":
		doc, err := s.GetRAGDocument(ctx, scope, actor, ref.ID)
		if err != nil {
			if err == ErrNotFound {
				return base, false, nil
			}
			return base, false, err
		}
		base.Label = doc.Title
		base.Summary = fmt.Sprintf("知识资料 %s，trustLevel=%s，sensitivity=%s，status=%s。", doc.Title, doc.TrustLevel, doc.Sensitivity, doc.Status)
		base.RiskLevel = sensitivityRisk(doc.Sensitivity)
		base.Metadata = map[string]any{"trustLevel": doc.TrustLevel, "sensitivity": doc.Sensitivity, "version": doc.Version}
		return base, true, nil
	case "attendance":
		items, _, err := s.ListAttendance(ctx, scope, 1, 500)
		if err != nil {
			return base, false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				base.Label = item.EmployeeName + " " + item.Day
				base.Summary = fmt.Sprintf("考勤信号：员工=%s，组织=%s，日期=%s，状态码=%d，签到=%v，签退=%v，备注=%s。该信号只能用于流程解释、异常提示和人工复核，不能自动形成绩效或淘汰结论。", item.EmployeeName, item.OrgUnitName, item.Day, item.AttendanceStatus, item.AttendanceInTime, item.AttendanceOutTime, item.Remarks)
				base.Metadata = map[string]any{"employeeName": item.EmployeeName, "orgUnit": item.OrgUnitName, "day": item.Day, "status": item.AttendanceStatus}
				return base, true, nil
			}
		}
	case "message":
		items, _, err := s.ListMessages(ctx, scope, 1, 500)
		if err != nil {
			return base, false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				base.Label = item.Title
				base.Summary = fmt.Sprintf("消息证据：标题=%s，分类=%s，作者=%s，范围=%s，浏览=%d。内容只作为组织沟通上下文和审计线索，不能作为无边界训练数据。", item.Title, item.Category, item.Author, item.ScopeType, item.View)
				base.Metadata = map[string]any{"category": item.Category, "author": item.Author, "scopeType": item.ScopeType}
				return base, true, nil
			}
		}
	case "learning_signal", "learning_mission", "learning_principle", "growth_evidence", "workflow_node":
		base.Label = label
		base.Source = "visual_selection.co_growth"
		base.Summary = coGrowthVisualSummary(ref.Type, label)
		base.Metadata = map[string]any{"coGrowthObjectType": ref.Type}
		return base, true, nil
	case "learning":
		courses, _, err := s.ListLearningCourses(ctx, scope, 1, 200)
		if err != nil {
			return base, false, err
		}
		for _, course := range courses {
			if course.ID == ref.ID {
				base.Label = course.Title
				base.Summary = fmt.Sprintf("学习课程 %s，课时=%d，状态=%s。", course.Title, course.LessonCount, course.Status)
				return base, true, nil
			}
		}
	case "agent_run":
		var run domain.AgentRun
		err := s.pool.QueryRow(ctx, `
			SELECT id::text, run_type, status, actor_user_id::text, provider, model, risk_level, summary, created_at
			FROM agent_runs
			WHERE id = $1
		`, ref.ID).Scan(&run.ID, &run.RunType, &run.Status, &run.ActorUserID, &run.Provider, &run.Model, &run.RiskLevel, &run.Summary, &run.CreatedAt)
		if err != nil {
			return base, false, nil
		}
		if !scope.Global && (run.ActorUserID == nil || *run.ActorUserID != actor.UserID) {
			return base, false, nil
		}
		base.Label = run.RunType
		base.Summary = fmt.Sprintf("Agent run %s，status=%s，riskLevel=%s，provider=%s/%s。%s", run.RunType, run.Status, run.RiskLevel, run.Provider, run.Model, run.Summary)
		base.RiskLevel = run.RiskLevel
		base.Metadata = map[string]any{"status": run.Status, "provider": run.Provider, "model": run.Model}
		return base, true, nil
	case "audit_event":
		var event domain.AuditEvent
		var oldRaw, newRaw []byte
		err := s.pool.QueryRow(ctx, `
			SELECT id::text, actor_user_id::text, event_type, object_type, object_id,
			       scope_type, scope_id::text, request_id, source, risk_level,
			       old_value_summary, new_value_summary, created_at
			FROM audit_events
			WHERE id = $1
		`, ref.ID).Scan(&event.ID, &event.ActorUserID, &event.EventType, &event.ObjectType, &event.ObjectID,
			&event.ScopeType, &event.ScopeID, &event.RequestID, &event.Source, &event.RiskLevel,
			&oldRaw, &newRaw, &event.CreatedAt)
		if err != nil {
			return base, false, nil
		}
		if !scope.Global && (event.ActorUserID == nil || *event.ActorUserID != actor.UserID) && !auditScopeVisible(scope, event.ScopeType, event.ScopeID) {
			return base, false, nil
		}
		event.OldValueSummary = map[string]any{}
		event.NewValueSummary = map[string]any{}
		_ = json.Unmarshal(oldRaw, &event.OldValueSummary)
		_ = json.Unmarshal(newRaw, &event.NewValueSummary)
		base.Label = event.EventType
		base.Summary = fmt.Sprintf("审计事件 %s，object=%s/%s，riskLevel=%s，source=%s。", event.EventType, event.ObjectType, event.ObjectID, event.RiskLevel, event.Source)
		base.RiskLevel = event.RiskLevel
		base.Metadata = map[string]any{"objectType": event.ObjectType, "objectId": event.ObjectID, "summary": event.NewValueSummary}
		return base, true, nil
	default:
		base.Summary = "未登记业务对象类型；只能作为页面选区上下文使用。"
		return base, true, nil
	}
	return base, false, nil
}

func (s *Store) legalEntityBusinessContext(ctx context.Context, scope Scope, id string) (string, string, error) {
	items, err := s.ListLegalEntities(ctx, scope)
	if err != nil {
		return "", "", err
	}
	for _, item := range items {
		if item.ID == id {
			return item.Name, legalEntityBusinessProfile(item), nil
		}
	}
	return "", "", nil
}

func (s *Store) orgUnitBusinessContext(ctx context.Context, scope Scope, id string) (string, string, error) {
	items, err := s.ListOrgUnits(ctx, scope)
	if err != nil {
		return "", "", err
	}
	for _, item := range items {
		if item.ID == id {
			return item.Name, orgUnitBusinessProfile(item), nil
		}
	}
	return "", "", nil
}

func valueOrDefault(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func sensitivityRisk(sensitivity string) string {
	switch strings.ToLower(sensitivity) {
	case "restricted", "sensitive", "secret":
		return "high"
	case "internal":
		return "medium"
	default:
		return "low"
	}
}

func (s *Store) CreateVisualCopilotEvent(ctx context.Context, userID string, req domain.VisualContextRequest, status, intent string, confidence float64, result map[string]any) (*domain.VisualCopilotEvent, error) {
	refs := collectBusinessRefs(req.Regions)
	regionsJSON, err := json.Marshal(req.Regions)
	if err != nil {
		return nil, err
	}
	domJSON, err := json.Marshal(map[string]any{
		"nodeCount":   len(req.DOM),
		"layoutItems": visualLayoutItemCount(req.Layout),
		"mode":        req.Mode,
		"viewport":    req.Viewport,
	})
	if err != nil {
		return nil, err
	}
	refsJSON, err := json.Marshal(refs)
	if err != nil {
		return nil, err
	}
	resultJSON, err := json.Marshal(nonNilMap(result))
	if err != nil {
		return nil, err
	}
	screenshotHash := ""
	if req.Screenshot != nil {
		if data, ok := req.Screenshot["dataBase64"].(string); ok && data != "" {
			sum := sha256.Sum256([]byte(data))
			screenshotHash = hex.EncodeToString(sum[:])
		}
	}
	var event domain.VisualCopilotEvent
	var regionsRaw, refsRaw []byte
	err = s.pool.QueryRow(ctx, `
		INSERT INTO visual_copilot_events (
			actor_user_id, route, instruction, regions, dom_summary, screenshot_hash,
			business_refs, intent, confidence, status, result
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING id::text, actor_user_id::text, route, instruction, regions, business_refs, intent, confidence, status, created_at
	`, userID, req.Route, req.Instruction, regionsJSON, domJSON, screenshotHash, refsJSON,
		intent, confidence, status, resultJSON).Scan(&event.ID, &event.ActorUserID, &event.Route,
		&event.Instruction, &regionsRaw, &refsRaw, &event.Intent, &event.Confidence, &event.Status,
		&event.CreatedAt)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(regionsRaw, &event.Regions)
	_ = json.Unmarshal(refsRaw, &event.BusinessRefs)
	return &event, nil
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

func (s *Store) ListVisualCopilotEvents(ctx context.Context, userID string, page, size int) ([]domain.VisualCopilotEvent, int64, error) {
	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM visual_copilot_events WHERE actor_user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, actor_user_id::text, route, instruction, regions, business_refs, intent, confidence, status, created_at
		FROM visual_copilot_events
		WHERE actor_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, size, (page-1)*size)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var events []domain.VisualCopilotEvent
	for rows.Next() {
		var event domain.VisualCopilotEvent
		var regionsRaw, refsRaw []byte
		if err := rows.Scan(&event.ID, &event.ActorUserID, &event.Route, &event.Instruction,
			&regionsRaw, &refsRaw, &event.Intent, &event.Confidence, &event.Status, &event.CreatedAt); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(regionsRaw, &event.Regions)
		_ = json.Unmarshal(refsRaw, &event.BusinessRefs)
		events = append(events, event)
	}
	return events, total, rows.Err()
}

func collectBusinessRefs(regions []domain.ScreenRegion) []domain.BusinessRef {
	seen := map[string]bool{}
	var refs []domain.BusinessRef
	for _, region := range regions {
		for _, ref := range region.BusinessRefs {
			key := ref.Type + ":" + ref.ID
			if !seen[key] {
				seen[key] = true
				refs = append(refs, ref)
			}
		}
	}
	return refs
}
