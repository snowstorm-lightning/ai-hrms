import { Button, Card, Form, Input, Select, Space, Table, Tag } from "antd";
import { useEffect, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { AgentRun } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function AgentRunsPage() {
  const [items, setItems] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();

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

  return (
    <div data-vc-page="agents">
      <PageTitle title="Agent 运行中心" description="查看自治运行、风险等级、provider 和审计状态。" />
      <InlineError message={error} onRetry={reload} />
      <Card>
        <Form
          form={form}
          layout="inline"
          initialValues={{ runType: "onboarding_companion", riskLevel: "low" }}
          onFinish={async (values) => {
            try {
              await api.createAgentRun(values);
              form.resetFields(["prompt"]);
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "创建 Agent 运行失败"));
            }
          }}
        >
          <Form.Item name="runType"><Select style={{ width: 210 }} options={[
            { value: "onboarding_companion", label: "入职陪跑 Agent" },
            { value: "knowledge_iteration", label: "知识库迭代 Agent" },
            { value: "data_quality", label: "数据质量 Agent" },
            { value: "visual_copilot", label: "Visual Copilot Agent" },
            { value: "co_growth_coach", label: "共进学习 Coach" },
            { value: "ai_literacy_path", label: "AI 素养路径 Agent" },
            { value: "work_learning_balance", label: "工学平衡 Agent" },
            { value: "agent_workflow_lab", label: "Agent Workflow Lab" },
            { value: "reflection_helper", label: "复盘辅助 Agent" },
          ]} /></Form.Item>
          <Form.Item name="riskLevel"><Select style={{ width: 150 }} options={[
            { value: "low", label: "低风险" },
            { value: "medium", label: "中风险" },
            { value: "high", label: "高风险" },
          ]} /></Form.Item>
          <Form.Item name="prompt" style={{ flex: 1 }}><Input placeholder="说明本次 Agent 任务" /></Form.Item>
          <Form.Item><Button data-vc-action="agent.run.create" type="primary" htmlType="submit">创建运行</Button></Form.Item>
        </Form>
      </Card>
      <Table
        className="section-card"
        rowKey="id"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: <EmptyBlock description="暂无 Agent 运行" /> }}
        onRow={(row) => ({
          "data-vc-kind": "agent-run-row",
          "data-vc-object-type": "agent_run",
          "data-vc-object-id": row.id,
          "data-vc-label": row.runType,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "类型", dataIndex: "runType" },
          { title: "状态", dataIndex: "status", render: (status) => <Tag color="green">{status}</Tag> },
          { title: "风险", dataIndex: "riskLevel", render: (risk) => <Tag color={risk === "high" ? "red" : risk === "medium" ? "orange" : "blue"}>{risk}</Tag> },
          { title: "Provider", render: (_, row) => `${row.provider} / ${row.model}` },
          { title: "摘要", dataIndex: "summary" },
          { title: "时间", dataIndex: "createdAt" },
        ]}
      />
    </div>
  );
}
