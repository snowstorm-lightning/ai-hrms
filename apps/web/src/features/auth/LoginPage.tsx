import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography } from "antd";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { getErrorMessage } from "../../api/client";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <Typography.Title level={1}>AI HRMS</Typography.Title>
        <Typography.Paragraph type="secondary">
          登录集团人力资源管理后台
        </Typography.Paragraph>
        {error ? <Alert type="error" message={error} showIcon /> : null}
        <Form
          layout="vertical"
          initialValues={{ mobile: "123", password: "password" }}
          onFinish={async (values) => {
            setError("");
            setSubmitting(true);
            try {
              await login(values);
              navigate("/app/dashboard");
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
            登录
          </Button>
          {demoMode ? (
            <Button
              className="demo-login-button"
              block
              onClick={async () => {
                setError("");
                setSubmitting(true);
                try {
                  await login({ mobile: "123", password: "password" });
                  navigate("/co-growth");
                } catch (err) {
                  setError(getErrorMessage(err, "Demo 登录失败"));
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              一键进入 Co-Growth Demo
            </Button>
          ) : null}
        </Form>
      </section>
    </main>
  );
}
