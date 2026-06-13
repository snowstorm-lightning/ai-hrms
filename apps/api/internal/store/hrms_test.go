package store

import (
	"strings"
	"testing"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
)

func TestHRResourceNamesIncludePlannedWorkDomains(t *testing.T) {
	want := []string{
		"leave-applications",
		"attendance-requests",
		"shift-assignments",
		"expense-claims",
		"salary-slips",
		"job-requisitions",
		"job-openings",
		"job-applicants",
		"interviews",
		"job-offers",
		"training-events",
		"performance-goals",
		"appraisal-cycles",
		"appraisals",
	}
	if len(HRResourceNames()) != len(want) {
		t.Fatalf("HRResourceNames length = %d, want %d", len(HRResourceNames()), len(want))
	}
	for _, resource := range want {
		if !ValidHRResource(resource) {
			t.Fatalf("ValidHRResource(%q) = false, want true", resource)
		}
	}
}

func TestHRStatusNeedsAction(t *testing.T) {
	for _, status := range []string{"submitted", "pending", "draft", "scheduled", "planned", "open", "active", "in_review"} {
		if !hrStatusNeedsAction(status) {
			t.Fatalf("hrStatusNeedsAction(%q) = false, want true", status)
		}
	}
	for _, status := range []string{"approved", "completed", "closed", "rejected"} {
		if hrStatusNeedsAction(status) {
			t.Fatalf("hrStatusNeedsAction(%q) = true, want false", status)
		}
	}
}

func TestWorkflowTransitionForStandardPaths(t *testing.T) {
	tests := []struct {
		action      string
		status      string
		nextStatus  string
		wantComment bool
	}{
		{action: "submit", status: "draft", nextStatus: "submitted"},
		{action: "start_review", status: "submitted", nextStatus: "in_review"},
		{action: "approve", status: "in_review", nextStatus: "approved"},
		{action: "reject", status: "submitted", nextStatus: "rejected", wantComment: true},
		{action: "cancel", status: "approved", nextStatus: "cancelled", wantComment: true},
	}
	for _, tt := range tests {
		transition, ok := workflowTransitionFor(tt.action, tt.status)
		if !ok {
			t.Fatalf("workflowTransitionFor(%q, %q) = false, want true", tt.action, tt.status)
		}
		if transition.NextStatus != tt.nextStatus {
			t.Fatalf("workflowTransitionFor(%q, %q).NextStatus = %q, want %q", tt.action, tt.status, transition.NextStatus, tt.nextStatus)
		}
		if transition.RequiresComment != tt.wantComment {
			t.Fatalf("workflowTransitionFor(%q, %q).RequiresComment = %v, want %v", tt.action, tt.status, transition.RequiresComment, tt.wantComment)
		}
	}
}

func TestWorkflowTransitionForRejectsInvalidPaths(t *testing.T) {
	for _, tt := range []struct {
		action string
		status string
	}{
		{action: "approve", status: "draft"},
		{action: "submit", status: "approved"},
		{action: "cancel", status: "submitted"},
		{action: "unknown", status: "submitted"},
	} {
		if _, ok := workflowTransitionFor(tt.action, tt.status); ok {
			t.Fatalf("workflowTransitionFor(%q, %q) = true, want false", tt.action, tt.status)
		}
	}
}

func TestWorkflowActionsRespectCapabilities(t *testing.T) {
	record := domain.HRRecord{Resource: "leave-applications", Status: "submitted"}
	withoutCapability := workflowActionsForRecord(rbac.Principal{}, record)
	if len(withoutCapability) == 0 {
		t.Fatalf("workflowActionsForRecord returned no actions")
	}
	for _, action := range withoutCapability {
		if action.Enabled {
			t.Fatalf("action %q enabled without leave.approve capability", action.Action)
		}
		if !strings.Contains(action.Reason, "leave.approve") {
			t.Fatalf("action %q reason = %q, want missing leave.approve", action.Action, action.Reason)
		}
	}

	withCapability := workflowActionsForRecord(rbac.Principal{Capabilities: []string{"leave.approve"}}, record)
	for _, action := range withCapability {
		if !action.Enabled {
			t.Fatalf("action %q disabled with leave.approve capability", action.Action)
		}
		if action.Reason != "" {
			t.Fatalf("action %q reason = %q, want empty", action.Action, action.Reason)
		}
	}
}

func TestWorkflowCapabilityForResource(t *testing.T) {
	want := map[string]string{
		"leave-applications":  "leave.approve",
		"attendance-requests": "attendance.manage",
		"job-requisitions":    "recruitment.manage",
		"interviews":          "recruitment.manage",
		"appraisals":          "performance.review",
		"salary-slips":        "payroll.read_sensitive",
		"expense-claims":      "employee.write",
	}
	for resource, capability := range want {
		if got := workflowCapabilityForResource(resource); got != capability {
			t.Fatalf("workflowCapabilityForResource(%q) = %q, want %q", resource, got, capability)
		}
	}
}
