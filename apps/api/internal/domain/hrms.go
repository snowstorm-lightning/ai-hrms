package domain

import "time"

type HRRecord struct {
	ID                  string         `json:"id"`
	Resource            string         `json:"resource"`
	Module              string         `json:"module"`
	RecordType          string         `json:"recordType"`
	Title               string         `json:"title"`
	EmployeeID          *string        `json:"employeeId"`
	EmployeeName        string         `json:"employeeName"`
	OrgUnitID           *string        `json:"orgUnitId"`
	OrgUnitName         string         `json:"orgUnitName"`
	ScopeType           string         `json:"scopeType"`
	ScopeID             *string        `json:"scopeId"`
	Status              string         `json:"status"`
	RiskLevel           string         `json:"riskLevel"`
	HumanReviewRequired bool           `json:"humanReviewRequired"`
	Payload             map[string]any `json:"payload"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
}

type HRRecordInput struct {
	Title               string         `json:"title"`
	EmployeeID          *string        `json:"employeeId"`
	OrgUnitID           *string        `json:"orgUnitId"`
	ScopeType           string         `json:"scopeType"`
	ScopeID             *string        `json:"scopeId"`
	Status              string         `json:"status"`
	RiskLevel           string         `json:"riskLevel"`
	HumanReviewRequired bool           `json:"humanReviewRequired"`
	Payload             map[string]any `json:"payload"`
}

type WorkbenchModuleSummary struct {
	Module      string         `json:"module"`
	Label       string         `json:"label"`
	Total       int64          `json:"total"`
	Pending     int64          `json:"pending"`
	HighRisk    int64          `json:"highRisk"`
	StatusCount map[string]int `json:"statusCount"`
}

type WorkbenchOverview struct {
	GeneratedAt time.Time                `json:"generatedAt"`
	Period      string                   `json:"period"`
	ScopeLabel  string                   `json:"scopeLabel"`
	Total       int64                    `json:"total"`
	Pending     int64                    `json:"pending"`
	HighRisk    int64                    `json:"highRisk"`
	Modules     []WorkbenchModuleSummary `json:"modules"`
}

type HRWorkItem struct {
	ID                  string    `json:"id"`
	Resource            string    `json:"resource"`
	Module              string    `json:"module"`
	RecordType          string    `json:"recordType"`
	Title               string    `json:"title"`
	EmployeeID          *string   `json:"employeeId"`
	EmployeeName        string    `json:"employeeName"`
	OrgUnitID           *string   `json:"orgUnitId"`
	OrgUnitName         string    `json:"orgUnitName"`
	Status              string    `json:"status"`
	RiskLevel           string    `json:"riskLevel"`
	HumanReviewRequired bool      `json:"humanReviewRequired"`
	Action              string    `json:"action"`
	CreatedAt           time.Time `json:"createdAt"`
}

type WorkflowAction struct {
	Action          string `json:"action"`
	Label           string `json:"label"`
	NextStatus      string `json:"nextStatus"`
	Variant         string `json:"variant"`
	RequiresComment bool   `json:"requiresComment"`
	Enabled         bool   `json:"enabled"`
	Reason          string `json:"reason,omitempty"`
}

type WorkflowEvent struct {
	ID          string    `json:"id"`
	Resource    string    `json:"resource"`
	RecordID    string    `json:"recordId"`
	ActorUserID *string   `json:"actorUserId,omitempty"`
	ActorName   string    `json:"actorName"`
	Action      string    `json:"action"`
	FromStatus  string    `json:"fromStatus"`
	ToStatus    string    `json:"toStatus"`
	Comment     string    `json:"comment"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ApprovalTask struct {
	ID               string     `json:"id"`
	Resource         string     `json:"resource"`
	RecordID         string     `json:"recordId"`
	RecordType       string     `json:"recordType"`
	Title            string     `json:"title"`
	Status           string     `json:"status"`
	Action           string     `json:"action"`
	AssignedToUserID *string    `json:"assignedToUserId,omitempty"`
	AssignedToName   string     `json:"assignedToName"`
	RequestedByName  string     `json:"requestedByName"`
	ScopeType        string     `json:"scopeType"`
	ScopeID          *string    `json:"scopeId,omitempty"`
	RiskLevel        string     `json:"riskLevel"`
	Comment          string     `json:"comment"`
	CompletedAt      *time.Time `json:"completedAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type HRWorkflow struct {
	Record        HRRecord         `json:"record"`
	Actions       []WorkflowAction `json:"actions"`
	Events        []WorkflowEvent  `json:"events"`
	ApprovalTasks []ApprovalTask   `json:"approvalTasks"`
}

type WorkflowActionInput struct {
	Action  string `json:"action"`
	Comment string `json:"comment"`
}

type WorkflowActionResult struct {
	Record   HRRecord       `json:"record"`
	Workflow HRWorkflow     `json:"workflow"`
	Event    *WorkflowEvent `json:"event,omitempty"`
}

type LeaveBalance struct {
	EmployeeID      string  `json:"employeeId"`
	EmployeeName    string  `json:"employeeName"`
	LeaveTypeID     string  `json:"leaveTypeId"`
	LeaveTypeCode   string  `json:"leaveTypeCode"`
	LeaveTypeName   string  `json:"leaveTypeName"`
	PeriodStart     string  `json:"periodStart"`
	PeriodEnd       string  `json:"periodEnd"`
	AllocatedDays   float64 `json:"allocatedDays"`
	LedgerDeltaDays float64 `json:"ledgerDeltaDays"`
	UsedDays        float64 `json:"usedDays"`
	BalanceDays     float64 `json:"balanceDays"`
}

type EmployeeCheckin struct {
	ID                 string    `json:"id"`
	EmployeeID         string    `json:"employeeId"`
	EmployeeName       string    `json:"employeeName"`
	OrgUnitName        string    `json:"orgUnitName"`
	LogType            string    `json:"logType"`
	LogTime            time.Time `json:"logTime"`
	Latitude           *float64  `json:"latitude,omitempty"`
	Longitude          *float64  `json:"longitude,omitempty"`
	Source             string    `json:"source"`
	AttendanceRecordID *string   `json:"attendanceRecordId,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
}

type EmployeeCheckinInput struct {
	EmployeeID string   `json:"employeeId"`
	LogType    string   `json:"logType"`
	LogTime    string   `json:"logTime"`
	Latitude   *float64 `json:"latitude"`
	Longitude  *float64 `json:"longitude"`
	Source     string   `json:"source"`
}
