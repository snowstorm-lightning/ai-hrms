import { ApiOutlined, AuditOutlined, CheckCircleOutlined, ClockCircleOutlined, RobotOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Select, Space, Table, Tag, Timeline, Typography, message } from "antd";
import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { AgentRun, AgentToolPreviewResponse, AgentWorkflowDemoResult } from "../../api/types";
import { ExecutionDecisionPanel, HumanReviewBanner, TrustMetaBar, TrustPacketBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { TaskPath } from "../../components/TaskFlow";

const runTypes = [
  "onboarding_companion",
  "knowledge_iteration",
  "data_quality",
  "visual_copilot",
  "co_growth_coach",
  "ai_literacy_path",
  "work_learning_balance",
  "agent_workflow_lab",
  "knowledge_governance",
  "onboarding_planner",
  "audit_risk_scanner",
];

function statusColor(status: string) {
  if (status.includes("waiting")) return "orange";
  if (status.includes("completed")) return "green";
  if (status.includes("blocked")) return "red";
  return "blue";
}

function confirmationStatus(run: AgentRun) {
  if (run.riskLevel === "high") return "等待人工确认";
  if (run.riskLevel === "medium") return "需要人工复核后执行";
  return "可保留为低风险预览";
}

const workflowStepLabels: Record<string, string> = {
  goal: "接收任务目标",
  risk_classification: "判断风险等级",
  context_collection: "收集授权上下文",
  tool_preview: "生成工具调用预览",
  human_review: "等待人工确认或记录复核",
};

function workflowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    received: "已接收",
    high: "高风险",
    medium: "中风险",
    low: "低风险",
    scoped: "已按 scope 限定",
    preview_only: "仅预览",
    preview_logged: "已记录预览",
    blocked_pending_human_review: "已阻断，等待人工确认",
  };
  return labels[status] ?? status;
}

export function AgentRunsPage() {
  const [items, setItems] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AgentToolPreviewResponse | null>(null);
  const [workflowPreview, setWorkflowPreview] = useState<{ runId: string; result: AgentWorkflowDemoResult } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form] = Form.useForm();
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.agentRuns(1, 20);
      setItems(result.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Agent 运行加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const stats = useMemo(() => ({
    high: items.filter((item) => item.riskLevel === "high").length,
    waiting: items.filter((item) => item.status.includes("waiting")).length,
    previewed: items.filter((item) => item.status.includes("preview")).length,
  }), [items]);

  return (
    <div className="agent-runs-page" data-vc-page="agents">
      <PageTitle
        title="Human-Agent Run Center"
        description="人和智能体协作的运行控制台：每次 run 都有 delegated context、tool preview、human confirmation 和 audit status。"
      />
      <InlineError message={error} onRetry={reload} />
      <TaskPath
        title="Agent 运行闭环"
        steps={[
          { title: "创建运行预览", detail: "先把目标、风险和 prompt 固定下来", status: items.length ? "done" : "current" },
          { title: "预览工具调用", detail: "检查工具名、参数、是否允许", status: preview ? "done" : "current" },
          { title: "查看执行链路", detail: "确认目标、风险、上下文、人工确认和审计", status: workflowPreview ? "done" : "next" },
          { title: "人工确认/审计", detail: "高风险只停在确认前，不直接写业务数据", status: stats.waiting ? "blocked" : "next" },
        ]}
      />

      <section className="agent-hero">
        <Card className="agent-create-card">
          <Alert
            showIcon
            type="info"
            title="Agent run 默认先进入预览"
            description="读操作可预览；写操作和高风险人事影响必须请求人工确认，真实执行由 Go 重新校验权限和 scope。"
          />
          <Form
            form={form}
            layout="vertical"
            initialValues={{ runType: "onboarding_planner", riskLevel: "medium", prompt: "为云衡互联网科技有限公司（虚构样本组织）新人林晨生成 30 天成长计划，并引用入职指南。" }}
            onFinish={async (values) => {
              setCreating(true);
              setError("");
              try {
                await api.createAgentRun(values);
                form.resetFields(["prompt"]);
                await reload();
                message.success("已创建 Demo Agent run 预览。");
              } catch (err) {
                setError(getErrorMessage(err, "创建 Agent 运行失败"));
              } finally {
                setCreating(false);
              }
            }}
          >
            <div className="agent-form-grid">
              <Form.Item name="runType" label="Agent 类型">
                <Select options={runTypes.map((value) => ({ value, label: value }))} />
              </Form.Item>
              <Form.Item name="riskLevel" label="风险等级">
                <Select options={[
                  { value: "low", label: "low：只读解释" },
                  { value: "medium", label: "medium：行动计划预览" },
                  { value: "high", label: "high：人工确认" },
                ]} />
              </Form.Item>
              <Form.Item name="prompt" label="Prompt summary">
                <Input placeholder="说明本次 Agent 任务" />
              </Form.Item>
              <Form.Item className="agent-submit-item">
                <Button data-vc-action="agent.run.create" type="primary" htmlType="submit" loading={creating} icon={<RobotOutlined />}>
                  创建运行预览
                </Button>
              </Form.Item>
            </div>
          </Form>
        </Card>
        <div className="agent-stat-grid">
          <Card><Typography.Text type="secondary">高风险 run</Typography.Text><Typography.Title level={3}>{stats.high}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">等待确认</Typography.Text><Typography.Title level={3}>{stats.waiting}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">工具预览</Typography.Text><Typography.Title level={3}>{stats.previewed}</Typography.Title></Card>
        </div>
      </section>

      {preview ? (
        <Card className="section-card" title="Tool Preview Result">
          <Alert
            showIcon
            type={preview.accepted ? "success" : "warning"}
            title={preview.message}
            description={`requiredRisk=${preview.requiredRisk} · executionMode=${String(preview.resultPreview.executionMode ?? "deterministic")}`}
          />
          <TrustPacketBar packet={preview.trustPacket} />
          <ExecutionDecisionPanel decision={preview.executionDecision} />
        </Card>
      ) : null}

      <section className="agent-run-grid" data-vc-kind="agent-run-cards">
        {items.map((run) => (
          <article className={run.riskLevel === "high" ? "agent-run-card high" : "agent-run-card"} key={run.id} data-vc-kind="agent-run-card" data-vc-object-type="agent_run" data-vc-object-id={run.id} data-vc-label={run.runType}>
            <div className="agent-run-top">
              <Space>
                <RobotOutlined />
                <Typography.Text strong>{run.runType}</Typography.Text>
              </Space>
              <Tag color={statusColor(run.status)}>{run.status}</Tag>
            </div>
            <Typography.Paragraph type="secondary">{run.summary}</Typography.Paragraph>
            <TrustMetaBar
              riskLevel={run.riskLevel}
              confidence={run.riskLevel === "high" ? 74 : run.riskLevel === "medium" ? 84 : 91}
              evidenceCount={run.riskLevel === "high" ? 3 : 2}
              humanReviewRequired={run.riskLevel === "high"}
              toolPreview
              auditStatus={run.riskLevel === "high" ? "waiting_human_review" : "previewed"}
            />
            <div className="agent-context-box">
              <Typography.Text strong>Delegated context</Typography.Text>
              <span>companyDataset=fictional_demo_company, personas=许安宁/林晨/周雨桐/顾明远, allowedTools=rag_search / learning_recommend / audit_read</span>
            </div>
            <Timeline
              items={[
                { icon: <ClockCircleOutlined />, content: "Goal captured" },
                { icon: <ApiOutlined />, content: "Tool preview generated" },
                { icon: <SafetyCertificateOutlined />, content: confirmationStatus(run) },
                { icon: <AuditOutlined />, content: "Audit event prepared" },
              ]}
            />
            <HumanReviewBanner
              riskLevel={run.riskLevel}
              humanReviewRequired={run.riskLevel === "high"}
              text={run.riskLevel === "high" ? "该 run 涉及公平性或人员影响，只能等待 HR 人工确认。" : "该 run 可以作为预览继续演示；执行前仍需权限和审计校验。"}
            />
            <div className="agent-action-help">
              <span>预览工具调用：看工具名、参数和是否允许。</span>
              <span>查看执行链路：看目标、风险、上下文、工具预览、人工确认和审计怎样串起来。</span>
            </div>
            <Space wrap>
              <Button
                size="small"
                loading={actionLoading === `${run.id}:tool`}
                onClick={async () => {
                  setActionLoading(`${run.id}:tool`);
                  setError("");
                  try {
                    setPreview(await api.previewAgentTool({ runId: run.id, toolName: run.riskLevel === "high" ? "people_decision_execute" : "learning_recommend", arguments: { runType: run.runType } }));
                  } catch (err) {
                    setError(getErrorMessage(err, "工具调用预览失败"));
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                预览工具调用
              </Button>
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => message.info(demoMode ? "Demo：已生成人工确认请求提示，未执行业务写入。" : "已生成人工确认请求提示，需审批后才能继续执行。")}
              >
                请求人工确认
              </Button>
              <Button
                size="small"
                icon={<ApiOutlined />}
                loading={actionLoading === `${run.id}:workflow`}
                onClick={async () => {
                  setActionLoading(`${run.id}:workflow`);
                  setError("");
                  try {
                    const result = await api.langGraphWorkflowDemo({ goal: run.summary, context: [`runType=${run.runType}`, `riskLevel=${run.riskLevel}`] });
                    setWorkflowPreview({ runId: run.id, result });
                    message.success("已生成执行链路预览；这一步没有执行工具或写入 HR 数据。");
                  } catch (err) {
                    setError(getErrorMessage(err, "执行链路预览失败"));
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                查看执行链路
              </Button>
            </Space>
            {workflowPreview?.runId === run.id ? (
              <div className="workflow-preview-panel" data-vc-kind="agent-workflow-preview">
                <div className="workflow-preview-header">
                  <div>
                    <Typography.Text strong>执行链路预览</Typography.Text>
                    <p>只展示这个 run 如果继续推进会经过哪些校验和记录；当前不会执行工具，也不会写入 HR 数据。</p>
                  </div>
                  <Tag color={workflowPreview.result.risk_level === "high" ? "red" : "orange"}>
                    {workflowStatusLabel(workflowPreview.result.risk_level)}
                  </Tag>
                </div>
                <div className="workflow-preview-meta">
                  <Tag>mode={workflowPreview.result.execution_mode ?? "preview_only"}</Tag>
                  <Tag>audit={workflowStatusLabel(workflowPreview.result.audit_status)}</Tag>
                  <Tag color={workflowPreview.result.human_review_required ? "orange" : "green"}>
                    humanReviewRequired={String(workflowPreview.result.human_review_required)}
                  </Tag>
                </div>
                <div className="workflow-preview-steps">
                  {workflowPreview.result.steps.map((step, index) => (
                    <div className="workflow-preview-step" key={`${step.name}-${index}`}>
                      <span>{index + 1}</span>
                      <div>
                        <Typography.Text strong>{workflowStepLabels[step.name] ?? step.name}</Typography.Text>
                        <Typography.Text type="secondary">{workflowStatusLabel(step.status)}</Typography.Text>
                      </div>
                    </div>
                  ))}
                </div>
                <Alert
                  showIcon
                  type="info"
                  title="预览边界"
                  description={workflowPreview.result.boundary ?? "Preview-only workflow. Human review is required before execution."}
                />
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <Table
        className="section-card hr-desktop-record-table"
        rowKey="id"
        loading={loading}
        dataSource={items}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: <EmptyBlock description="暂无 Agent 运行" /> }}
        onRow={(row) => ({
          "data-vc-kind": "agent-run-row",
          "data-vc-object-type": "agent_run",
          "data-vc-object-id": row.id,
          "data-vc-label": row.runType,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "类型", dataIndex: "runType", width: 210 },
          { title: "状态", dataIndex: "status", width: 180, render: (status) => <Tag color={statusColor(status)}>{status}</Tag> },
          { title: "风险", dataIndex: "riskLevel", width: 100, render: (risk) => <Tag color={risk === "high" ? "red" : risk === "medium" ? "orange" : "blue"}>{risk}</Tag> },
          { title: "Provider", width: 220, render: (_, row) => row.provider === "fake" ? "Demo deterministic adapter" : `${row.provider} / ${row.model}` },
          { title: "人工确认", width: 220, render: (_, row) => confirmationStatus(row) },
          { title: "时间", dataIndex: "createdAt", width: 220 },
        ]}
      />
    </div>
  );
}
