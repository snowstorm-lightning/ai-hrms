package domain

import "time"

type Capability struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type AuditEvent struct {
	ID              string         `json:"id"`
	ActorUserID     *string        `json:"actorUserId"`
	EventType       string         `json:"eventType"`
	ObjectType      string         `json:"objectType"`
	ObjectID        string         `json:"objectId"`
	ScopeType       string         `json:"scopeType"`
	ScopeID         *string        `json:"scopeId"`
	RequestID       string         `json:"requestId"`
	Source          string         `json:"source"`
	RiskLevel       string         `json:"riskLevel"`
	OldValueSummary map[string]any `json:"oldValueSummary"`
	NewValueSummary map[string]any `json:"newValueSummary"`
	CreatedAt       time.Time      `json:"createdAt"`
}

type RAGSource struct {
	ID              string    `json:"id"`
	SourceType      string    `json:"sourceType"`
	Name            string    `json:"name"`
	URI             string    `json:"uri"`
	Status          string    `json:"status"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
}

type RAGDocumentScope struct {
	ID                 string  `json:"id,omitempty"`
	DocumentID         string  `json:"documentId,omitempty"`
	ScopeType          string  `json:"scopeType"`
	ScopeID            *string `json:"scopeId"`
	RoleCode           *string `json:"roleCode,omitempty"`
	EmployeeID         *string `json:"employeeId,omitempty"`
	IncludeDescendants bool    `json:"includeDescendants"`
}

type RAGDocument struct {
	ID              string             `json:"id"`
	SourceID        *string            `json:"sourceId"`
	Title           string             `json:"title"`
	Version         string             `json:"version"`
	Status          string             `json:"status"`
	TrustLevel      string             `json:"trustLevel"`
	Sensitivity     string             `json:"sensitivity"`
	Content         string             `json:"content,omitempty"`
	EffectiveFrom   *time.Time         `json:"effectiveFrom"`
	EffectiveTo     *time.Time         `json:"effectiveTo"`
	PublishedAt     *time.Time         `json:"publishedAt"`
	CreatedByUserID *string            `json:"createdByUserId"`
	CreatedAt       time.Time          `json:"createdAt"`
	Scopes          []RAGDocumentScope `json:"scopes,omitempty"`
}

type RAGIngestJob struct {
	ID              string             `json:"id"`
	SourceID        *string            `json:"sourceId"`
	DocumentID      *string            `json:"documentId"`
	JobType         string             `json:"jobType"`
	Status          string             `json:"status"`
	Provider        string             `json:"provider"`
	Title           string             `json:"title,omitempty"`
	Content         string             `json:"content,omitempty"`
	Scopes          []RAGDocumentScope `json:"scopes,omitempty"`
	Summary         string             `json:"summary"`
	Error           string             `json:"error"`
	CreatedByUserID *string            `json:"createdByUserId"`
	CreatedAt       time.Time          `json:"createdAt"`
	CompletedAt     *time.Time         `json:"completedAt"`
}

type RAGCitation struct {
	DocumentID  string  `json:"documentId"`
	ChunkID     string  `json:"chunkId"`
	Title       string  `json:"title"`
	Snippet     string  `json:"snippet"`
	TrustLevel  string  `json:"trustLevel,omitempty"`
	Sensitivity string  `json:"sensitivity,omitempty"`
	Score       float64 `json:"score,omitempty"`
}

type RAGSearchRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit"`
}

type RAGEmbeddingInput struct {
	Content    string
	Provider   string
	Model      string
	Dimensions int
	Vector     []float64
}

type RAGSearchResult struct {
	Answer              string        `json:"answer"`
	Citations           []RAGCitation `json:"citations"`
	RefusalReason       string        `json:"refusalReason,omitempty"`
	Provider            string        `json:"provider,omitempty"`
	Model               string        `json:"model,omitempty"`
	Confidence          float64       `json:"confidence,omitempty"`
	RiskLevel           string        `json:"riskLevel,omitempty"`
	HumanReviewRequired bool          `json:"humanReviewRequired,omitempty"`
	AuditStatus         string        `json:"auditStatus,omitempty"`
}

type AIChatRequest struct {
	Message string `json:"message"`
}

type AIChatResponse struct {
	Message             string        `json:"message"`
	Citations           []RAGCitation `json:"citations"`
	Provider            string        `json:"provider,omitempty"`
	Model               string        `json:"model,omitempty"`
	Confidence          float64       `json:"confidence,omitempty"`
	RiskLevel           string        `json:"riskLevel,omitempty"`
	HumanReviewRequired bool          `json:"humanReviewRequired,omitempty"`
	AuditStatus         string        `json:"auditStatus,omitempty"`
}

type LearningCourse struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Status          string    `json:"status"`
	ScopeType       string    `json:"scopeType"`
	ScopeID         *string   `json:"scopeId"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
	LessonCount     int       `json:"lessonCount"`
}

type LearningLesson struct {
	ID            string  `json:"id"`
	CourseID      string  `json:"courseId"`
	Title         string  `json:"title"`
	Content       string  `json:"content"`
	SortOrder     int     `json:"sortOrder"`
	RAGDocumentID *string `json:"ragDocumentId"`
}

type LearningEnrollment struct {
	ID           string     `json:"id"`
	EmployeeID   string     `json:"employeeId"`
	EmployeeName string     `json:"employeeName"`
	CourseID     string     `json:"courseId"`
	CourseTitle  string     `json:"courseTitle"`
	Status       string     `json:"status"`
	DueDate      *time.Time `json:"dueDate"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type LearningRecommendation struct {
	ID                 string    `json:"id"`
	EmployeeID         *string   `json:"employeeId"`
	RecommendationType string    `json:"recommendationType"`
	Title              string    `json:"title"`
	Reason             string    `json:"reason"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"createdAt"`
}

type AgentRun struct {
	ID          string    `json:"id"`
	RunType     string    `json:"runType"`
	Status      string    `json:"status"`
	ActorUserID *string   `json:"actorUserId"`
	Provider    string    `json:"provider"`
	Model       string    `json:"model"`
	RiskLevel   string    `json:"riskLevel"`
	Summary     string    `json:"summary"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AgentToolPreviewRequest struct {
	RunID     *string        `json:"runId"`
	ToolName  string         `json:"toolName"`
	Arguments map[string]any `json:"arguments"`
	UserID    string         `json:"userId,omitempty"`
}

type AgentToolPreviewResponse struct {
	Accepted      bool           `json:"accepted"`
	Message       string         `json:"message"`
	RequiredRisk  string         `json:"requiredRisk"`
	ResultPreview map[string]any `json:"resultPreview"`
}

type AgentActionPlan struct {
	ID                   string    `json:"id"`
	RunID                string    `json:"runId"`
	Title                string    `json:"title"`
	RiskLevel            string    `json:"riskLevel"`
	Status               string    `json:"status"`
	RequiresConfirmation bool      `json:"requiresConfirmation"`
	CreatedAt            time.Time `json:"createdAt"`
}

type BusinessRef struct {
	Type  string `json:"type"`
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
}

type ScreenRegion struct {
	ID           string         `json:"id"`
	Mode         string         `json:"mode"`
	Rect         map[string]any `json:"rect"`
	Selector     string         `json:"selector,omitempty"`
	BusinessRefs []BusinessRef  `json:"businessRefs"`
}

type VisualContextRequest struct {
	Route       string         `json:"route"`
	Viewport    map[string]any `json:"viewport"`
	Screenshot  map[string]any `json:"screenshot,omitempty"`
	DOM         []any          `json:"dom"`
	Regions     []ScreenRegion `json:"regions"`
	Instruction string         `json:"instruction"`
}

type VisualCopilotEvent struct {
	ID           string         `json:"id"`
	ActorUserID  *string        `json:"actorUserId"`
	Route        string         `json:"route"`
	Instruction  string         `json:"instruction"`
	Regions      []ScreenRegion `json:"regions"`
	BusinessRefs []BusinessRef  `json:"businessRefs"`
	Intent       string         `json:"intent"`
	Confidence   float64        `json:"confidence"`
	Status       string         `json:"status"`
	CreatedAt    time.Time      `json:"createdAt"`
}
