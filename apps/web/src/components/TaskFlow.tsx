import { Button, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";

export interface TaskFlowStep {
  title: string;
  detail?: string;
  status?: "done" | "current" | "next" | "blocked";
}

export interface TaskFlowAction {
  label: string;
  onClick: () => void;
  type?: "primary" | "default";
  icon?: ReactNode;
}

function statusLabel(status: TaskFlowStep["status"]) {
  if (status === "done") return "已完成";
  if (status === "current") return "当前";
  if (status === "blocked") return "待确认";
  return "下一步";
}

function statusColor(status: TaskFlowStep["status"]) {
  if (status === "done") return "green";
  if (status === "current") return "blue";
  if (status === "blocked") return "orange";
  return "default";
}

export function TaskPath({ title = "当前工作闭环", steps }: { title?: string; steps: TaskFlowStep[] }) {
  return (
    <section className="task-flow" data-vc-kind="task-flow">
      <div className="task-flow-header">
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary">按这条线完成一次可审计的工作，不需要在页面之间猜下一步。</Typography.Text>
      </div>
      <div className="task-flow-steps">
        {steps.map((step, index) => (
          <div className={`task-flow-step is-${step.status ?? "next"}`} key={`${step.title}-${index}`}>
            <span className="task-flow-index">{index + 1}</span>
            <div>
              <Space wrap>
                <Typography.Text strong>{step.title}</Typography.Text>
                <Tag color={statusColor(step.status)}>{statusLabel(step.status)}</Tag>
              </Space>
              {step.detail ? <Typography.Text type="secondary">{step.detail}</Typography.Text> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActionResultGuide({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: TaskFlowAction[];
}) {
  return (
    <section className="action-result-guide" data-vc-kind="action-result-guide">
      <div>
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary">{description}</Typography.Text>
      </div>
      <Space wrap>
        {actions.map((action) => (
          <Button key={action.label} icon={action.icon} onClick={action.onClick} size="small" type={action.type}>
            {action.label}
          </Button>
        ))}
      </Space>
    </section>
  );
}
