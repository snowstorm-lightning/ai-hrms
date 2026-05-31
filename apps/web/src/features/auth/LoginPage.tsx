import {
  AuditOutlined,
  DatabaseOutlined,
  LockOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Form, Input, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { getErrorMessage } from "../../api/client";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const from = typeof location.state === "object" && location.state && "from" in location.state
    ? String(location.state.from)
    : "/app/dashboard";

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <Tag color="blue">{demoMode ? "Assignment Demo" : "Local seeded environment"}</Tag>
        <Typography.Title level={1}>AI-HRMS｜人机共生的人力资源智能操作系统</Typography.Title>
        <Typography.Paragraph>
          连接组织数据、知识库、学习成长、智能体运行和审计治理，让 HR 与 AI Agent 在可追溯边界内共同完成工作。
        </Typography.Paragraph>
        <div className="login-feature-grid">
          <div><DatabaseOutlined /><span>组织数据层</span></div>
          <div><RobotOutlined /><span>Agent 协作层</span></div>
          <div><ThunderboltOutlined /><span>Co-Growth 成长引擎</span></div>
          <div><AuditOutlined /><span>审计证据层</span></div>
        </div>
        <Alert
          showIcon
          icon={<SafetyCertificateOutlined />}
          type="info"
          title={demoMode ? "Demo 使用 deterministic mock AI" : "真实后端模式：DeepSeek / Agent / RAG 由本地环境变量控制"}
          description={demoMode ? "不调用外部 LLM，不发送个人敏感数据；高风险 HR 建议只生成预览并要求人工确认。" : "当前登录进入本机种子环境。外部 LLM 与 embedding 只通过 agent boundary 调用，高风险 HR 建议仍必须人工确认。"}
        />
      </section>
      <section className="login-panel">
        <Typography.Title level={2}>{demoMode ? "进入 AI-HRMS Demo" : "进入 AI-HRMS 本地环境"}</Typography.Title>
        <Typography.Paragraph type="secondary">
          推荐从 Command Dashboard 开始，3 分钟内浏览 AI 指挥、知识治理、Co-Growth、Agent Run 和审计证据链。
        </Typography.Paragraph>
        {error ? <Alert type="error" title={error} showIcon /> : null}
        <Form
          layout="vertical"
          initialValues={demoMode ? { mobile: "123", password: "password" } : undefined}
          onFinish={async (values) => {
            setError("");
            setSubmitting(true);
            try {
              await login(values);
              navigate(from);
            } catch (err) {
              setError(getErrorMessage(err, "登录失败"));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item name="mobile" label="手机号" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder="手机号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            进入操作系统
          </Button>
          {demoMode ? (
            <Space orientation="vertical" className="demo-login-actions">
              <Button
                className="demo-login-button"
                type="primary"
                block
                loading={submitting}
                disabled={submitting}
                onClick={async () => {
                  setError("");
                  setSubmitting(true);
                  try {
                    await login({ mobile: "123", password: "password" });
                    navigate(from);
                  } catch (err) {
                    setError(getErrorMessage(err, "Demo 登录失败"));
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                一键进入 AI-HRMS Demo
              </Button>
            </Space>
          ) : null}
        </Form>
      </section>
    </main>
  );
}
