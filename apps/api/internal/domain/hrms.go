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
