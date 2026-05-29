from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, StateGraph


class WorkflowState(TypedDict):
    goal: str
    context: list[str]
    risk_level: str
    human_review_required: bool
    audit_status: str
    steps: list[dict[str, str]]


def run_hr_workflow(goal: str, context: list[str] | None = None) -> WorkflowState:
    graph = StateGraph(WorkflowState)

    def classify(state: WorkflowState) -> WorkflowState:
        goal_text = state["goal"].lower()
        high_risk = any(term in goal_text for term in ["hire", "fire", "salary", "promotion", "录用", "淘汰", "降薪", "晋升"])
        state["risk_level"] = "high" if high_risk else "medium"
        state["human_review_required"] = True
        state["steps"].append({"name": "risk_classification", "status": state["risk_level"]})
        return state

    def collect_context(state: WorkflowState) -> WorkflowState:
        state["context"].append("Only scoped RAG citations and delegated context may enter the agent run.")
        state["steps"].append({"name": "context_collection", "status": "scoped"})
        return state

    def plan_tools(state: WorkflowState) -> WorkflowState:
        state["steps"].append({"name": "tool_preview", "status": "preview_only"})
        return state

    def human_gate(state: WorkflowState) -> WorkflowState:
        state["audit_status"] = "blocked_pending_human_review" if state["risk_level"] == "high" else "preview_logged"
        state["steps"].append({"name": "human_review", "status": state["audit_status"]})
        return state

    graph.add_node("classify", classify)
    graph.add_node("collect_context", collect_context)
    graph.add_node("plan_tools", plan_tools)
    graph.add_node("human_gate", human_gate)
    graph.set_entry_point("classify")
    graph.add_edge("classify", "collect_context")
    graph.add_edge("collect_context", "plan_tools")
    graph.add_edge("plan_tools", "human_gate")
    graph.add_edge("human_gate", END)

    app = graph.compile()
    return app.invoke(
        {
            "goal": goal,
            "context": list(context or []),
            "risk_level": "medium",
            "human_review_required": True,
            "audit_status": "draft",
            "steps": [{"name": "goal", "status": "received"}],
        }
    )
