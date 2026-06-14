import type { HRWorkItem } from "../../api/types";

export function employeeOpsTabForResource(resource: string) {
  switch (resource) {
    case "leave-applications":
      return "leave";
    case "attendance-requests":
      return "attendance-requests";
    case "shift-assignments":
      return "shifts";
    case "expense-claims":
      return "expenses";
    case "salary-slips":
      return "salary";
    default:
      return "approvals";
  }
}

export function recruitmentTabForResource(resource: string) {
  switch (resource) {
    case "job-requisitions":
      return "requisitions";
    case "job-openings":
      return "openings";
    case "job-applicants":
      return "applicants";
    case "interviews":
      return "interviews";
    case "job-offers":
      return "offers";
    default:
      return "requisitions";
  }
}

export function growthTabForResource(resource: string) {
  switch (resource) {
    case "training-events":
      return "training";
    case "performance-goals":
      return "goals";
    case "appraisal-cycles":
      return "cycles";
    case "appraisals":
      return "appraisals";
    default:
      return "quick";
  }
}

function domainRoute(path: string, tab: string, resource: string, id?: string) {
  const params = new URLSearchParams({ tab, resource });
  if (id) params.set("id", id);
  return `${path}?${params.toString()}`;
}

export function workItemRoute(item: Pick<HRWorkItem, "module" | "resource"> & { id?: string }) {
  if (item.module === "employee_ops") {
    const tab = employeeOpsTabForResource(item.resource);
    return domainRoute("/app/employee-ops", tab, item.resource, item.id);
  }
  if (item.module === "recruitment_lifecycle") {
    const tab = recruitmentTabForResource(item.resource);
    return domainRoute("/app/recruitment-lifecycle", tab, item.resource, item.id);
  }
  if (item.module === "growth_performance") {
    const tab = growthTabForResource(item.resource);
    return domainRoute("/app/growth-performance", tab, item.resource, item.id);
  }
  return "/app/trust-audit";
}
