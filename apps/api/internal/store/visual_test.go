package store

import "testing"

func TestVisualBusinessRefCapability(t *testing.T) {
	tests := map[string]string{
		"employee":     "employee.read",
		"user":         "employee.read",
		"legal_entity": "employee.read",
		"org_unit":     "employee.read",
		"rag_document": "rag.search",
		"learning":     "learning.view",
		"agent_run":    "agent.execute_read",
		"audit_event":  "audit.read",
		"unknown":      "",
	}
	for refType, want := range tests {
		if got := visualBusinessRefCapability(refType); got != want {
			t.Fatalf("visualBusinessRefCapability(%q) = %q, want %q", refType, got, want)
		}
	}
}
