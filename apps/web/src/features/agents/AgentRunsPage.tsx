import { ApiOutlined, AuditOutlined, CheckCircleOutlined, ClockCircleOutlined, RobotOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Select, Space, Table, Tag, Timeline, Typography, message } from "antd";
import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
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

const runTypeLabels: Record<string, string> = {
  onboarding_companion: "新人陪跑",
  knowledge_iteration: "知识迭代",
  data_quality: "数据质量检查",
  visual_copilot: "圈选助手",
  co_growth_coach: "共生成长教练",
  ai_literacy_path: "AI 素养路径",
  work_learning_balance: "工作学习平衡",
  agent_workflow_lab: "执行链路实验",
  knowledge_governance: "知识治理",
  onboarding_planner: "新人计划生成",
  audit_risk_scanner: "审计风险扫描",
};

function runTypeLabel(type: string) {
  return runTypeLabels[type] ?? type;
}

function riskLabel(risk: string) {
  const labels: Record<string, string> = {
    high: "高风险",
    medium: "中风险",
    low: "低风险",
  };
  return labels[risk] ?? risk;
}

function executionModeLabel(mode: unknown) {
  const value = typeof mode === "string" ? mode : undefined;
  const labels: Record<string, string> = {
    deterministic: "确定性预览",
    preview_only: "仅预览",
    human_review: "等待人工确认",
  };
  return labels[value ?? "deterministic"] ?? value ?? "确定性预览";
}

function workflowBoundaryText(boundary: string | undefined) {
  if (!boundary) return "当前只是流程预览；真正执行前需要经过权限、审计和人工确认。";
  if (boundary.includes("LangGraph demo only")) {
    return "这是执行链路演示：当前不会写入 HR 数据，也不会真正调用工具；任何真实工作流都必须先经过权限、审计和人工确认。";
  }
  return boundary;
}

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
  tool_preview: "生成动作草稿",
  human_review: "等待人工确认或记录复核",
};

function workflowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    received: "已接收",
    created: "已创建",
    previewed: "已预览",
    waiting_human_review: "等待人工确认",
    completed: "已完成",
    high: "高风险",
    medium: "中风险",
    low: "低风险",
    scoped: "已按可见范围限定",
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
  const [previewTitle, setPreviewTitle] = useState("");
  const [workflowPreview, setWorkflowPreview] = useState<{ runId: string; result: AgentWorkflowDemoResult } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form] = Form.useForm();
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const previewRef = useRef<HTMLDivElement | null>(null);

  const showPreview = (title: string, nextPreview: AgentToolPreviewResponse) => {
    setPreviewTitle(title);
    setPreview(nextPreview);
    window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.agentRuns(1, 20);
      setItems(result.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "智能任务加载失败"));
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
        title="人机协作运行中心"
        description="每次运行都记录授权上下文、动作草稿、人工确认和审计状态；用户能看到当前卡在哪一步。"
      />
      <InlineError message={error} onRetry={reload} />
      <TaskPath
        title="智能任务运行闭环"
        steps={[
          { title: "生成任务预览", detail: "先把目标、风险和任务说明固定下来", status: items.length ? "done" : "current" },
          { title: "查看动作草稿", detail: "检查动作、参数和是否需要人工确认", status: preview ? "done" : "current" },
          { title: "查看执行链路", detail: "确认目标、风险、上下文、人工确认和审计", status: workflowPreview ? "done" : "next" },
          { title: "人工确认/审计", detail: "高风险只停在确认前，不直接写业务数据", status: stats.waiting ? "blocked" : "next" },
        ]}
      />

      <section className="agent-hero">
        <Card className="agent-create-card">
          <Alert
            showIcon
            type="info"
            title="智能体运行默认先进入预览"
            description="读操作可预览；写操作和高风险人事影响必须请求人工确认，提交前系统会重新校验权限和可见范围。"
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
                message.success("已生成智能任务预览。");
              } catch (err) {
                setError(getErrorMessage(err, "智能任务预览生成失败"));
              } finally {
                setCreating(false);
              }
            }}
          >
            <div className="agent-form-grid">
              <Form.Item name="runType" label="智能体类型">
                <Select options={runTypes.map((value) => ({ value, label: runTypeLabel(value) }))} />
              </Form.Item>
              <Form.Item name="riskLevel" label="风险等级">
                <Select options={[
                  { value: "low", label: "低风险：只读解释" },
                  { value: "medium", label: "中风险：行动计划预览" },
                  { value: "high", label: "高风险：必须人工确认" },
                ]} />
              </Form.Item>
              <Form.Item name="prompt" label="任务摘要">
                <Input placeholder="说明本次智能任务" />
              </Form.Item>
              <Form.Item className="agent-submit-item">
                <Button data-vc-action="agent.run.create" type="primary" htmlType="submit" loading={creating} icon={<RobotOutlined />}>
                  生成任务预览
                </Button>
              </Form.Item>
            </div>
          </Form>
        </Card>
        <div className="agent-stat-grid">
          <Card><Typography.Text type="secondary">高风险运行</Typography.Text><Typography.Title level={3}>{stats.high}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">等待确认</Typography.Text><Typography.Title level={3}>{stats.waiting}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">动作草稿</Typography.Text><Typography.Title level={3}>{stats.previewed}</Typography.Title></Card>
        </div>
      </section>

      {preview ? (
        <Card className="section-card result-panel-highlight" title="动作草稿结果" ref={previewRef}>
          <Typography.Text strong>{previewTitle || "动作草稿结果"}</Typography.Text>
          <Alert
            showIcon
            type={preview.accepted ? "success" : "warning"}
            title={preview.message}
            description={`要求风险：${riskLabel(preview.requiredRisk)} · 执行方式：${executionModeLabel(preview.resultPreview.executionMode)}`}
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
                <Typography.Text strong>{runTypeLabel(run.runType)}</Typography.Text>
              </Space>
              <Tag color={statusColor(run.status)}>{workflowStatusLabel(run.status)}</Tag>
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
              <Typography.Text strong>授权上下文</Typography.Text>
              <span>样本数据集：虚构演示组织；可用人员：许安宁、林晨、周雨桐、顾明远；允许工具：知识检索、学习推荐、审计读取。</span>
            </div>
            <Timeline
              items={[
                { icon: <ClockCircleOutlined />, content: "已接收任务目标" },
                { icon: <ApiOutlined />, content: "已生成动作草稿" },
                { icon: <SafetyCertificateOutlined />, content: confirmationStatus(run) },
                { icon: <AuditOutlined />, content: "已准备审计记录" },
              ]}
            />
            <HumanReviewBanner
              riskLevel={run.riskLevel}
              humanReviewRequired={run.riskLevel === "high"}
              text={run.riskLevel === "high" ? "该任务涉及公平性或人员影响，只能等待 HR 人工确认。" : "该任务可以作为预览继续演示；执行前仍需权限和审计校验。"}
            />
            <div className="agent-action-help">
              <span>查看动作草稿：看动作、参数和是否允许。</span>
              <span>查看执行链路：看目标、风险、上下文、动作草稿、人工确认和审计怎样串起来。</span>
            </div>
            <Space wrap>
              <Button
                size="small"
                loading={actionLoading === `${run.id}:tool`}
                onClick={async () => {
                  setActionLoading(`${run.id}:tool`);
                  setError("");
                  try {
                    showPreview(`当前任务：${runTypeLabel(run.runType)} / ${riskLabel(run.riskLevel)}`, await api.previewAgentTool({ runId: run.id, toolName: run.riskLevel === "high" ? "people_decision_execute" : "learning_recommend", arguments: { runType: run.runType } }));
                  } catch (err) {
                    setError(getErrorMessage(err, "动作草稿生成失败"));
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                查看动作草稿
              </Button>
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => message.info(demoMode ? "已生成人工确认请求提示，未执行业务写入。" : "已生成人工确认请求提示，需审批后才能继续执行。")}
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
                    const result = await api.langGraphWorkflowDemo({ goal: run.summary, context: [`运行类型：${runTypeLabel(run.runType)}`, `风险等级：${riskLabel(run.riskLevel)}`] });
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
                    <p>只展示这次运行如果继续推进会经过哪些校验和记录；当前不会执行工具，也不会写入 HR 数据。</p>
                  </div>
                  <Tag color={workflowPreview.result.risk_level === "high" ? "red" : "orange"}>
                    {workflowStatusLabel(workflowPreview.result.risk_level)}
                  </Tag>
                </div>
                <div className="workflow-preview-meta">
                  <Tag>模式：{executionModeLabel(workflowPreview.result.execution_mode)}</Tag>
                  <Tag>审计：{workflowStatusLabel(workflowPreview.result.audit_status)}</Tag>
                  <Tag color={workflowPreview.result.human_review_required ? "orange" : "green"}>
                    {workflowPreview.result.human_review_required ? "需要人工复核" : "无需人工复核"}
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
                  description={workflowBoundaryText(workflowPreview.result.boundary)}
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
        locale={{ emptyText: <EmptyBlock description="暂无智能任务运行" /> }}
        onRow={(row) => ({
          "data-vc-kind": "agent-run-row",
          "data-vc-object-type": "agent_run",
          "data-vc-object-id": row.id,
          "data-vc-label": row.runType,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "类型", dataIndex: "runType", width: 210, render: (type) => runTypeLabel(type) },
          { title: "状态", dataIndex: "status", width: 180, render: (status) => <Tag color={statusColor(status)}>{workflowStatusLabel(status)}</Tag> },
          { title: "风险", dataIndex: "riskLevel", width: 100, render: (risk) => <Tag color={risk === "high" ? "red" : risk === "medium" ? "orange" : "blue"}>{riskLabel(risk)}</Tag> },
          { title: "运行适配器", width: 220, render: (_, row) => row.provider === "fake" ? "演示适配器" : `${row.provider} / ${row.model}` },
          { title: "人工确认", width: 220, render: (_, row) => confirmationStatus(row) },
          { title: "时间", dataIndex: "createdAt", width: 220 },
        ]}
      />
    </div>
  );
}
