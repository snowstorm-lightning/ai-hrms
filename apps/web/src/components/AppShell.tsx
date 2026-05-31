import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  MenuOutlined,
  IdcardOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Avatar, Button, Drawer, Dropdown, Layout, Menu, Tag, theme, Typography } from "antd";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AIProviderStatus } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { PageLoading } from "./PageLoading";

const { Header, Sider, Content } = Layout;

const commandMenuItems = [
  { key: "/app/dashboard", icon: <DashboardOutlined />, label: "OS Command Dashboard" },
  { key: "/app/ai-command", icon: <RobotOutlined />, label: "Agent Command Center" },
  { key: "/app/knowledge", icon: <DatabaseOutlined />, label: "Governed Knowledge" },
  { key: "/app/agents", icon: <TeamOutlined />, label: "Agent Run Control" },
  { key: "/app/audit", icon: <AuditOutlined />, label: "Trust & Evidence" },
];

const growthMenuItems = [
  { key: "/co-growth", icon: <ExperimentOutlined />, label: <span>Co-Growth Engine <Tag color="geekblue">独立工作区</Tag></span> },
  { key: "/app/learning", icon: <BookOutlined />, label: "Learning Evidence" },
];

const dataMenuItems = [
  { key: "/app/legal-entities", icon: <BankOutlined />, label: "法人 scope" },
  { key: "/app/org-units", icon: <ApartmentOutlined />, label: "组织 scope" },
  { key: "/app/users", icon: <UserOutlined />, label: "账号与角色" },
  { key: "/app/employees", icon: <IdcardOutlined />, label: "员工数据层" },
  { key: "/app/attendance", icon: <ClockCircleOutlined />, label: "考勤信号" },
  { key: "/app/messages", icon: <MessageOutlined />, label: "消息证据" },
];

const helpMenuItems = [
  { key: "/app/help", icon: <QuestionCircleOutlined />, label: "新手使用指南" },
];

const menuItems = [
  { type: "group" as const, label: "AI-HRMS 操作系统", children: commandMenuItems },
  { type: "group" as const, label: "成长引擎与证据", children: growthMenuItems },
  { type: "group" as const, label: "组织数据与管理", children: dataMenuItems },
  { type: "group" as const, label: "帮助", children: helpMenuItems },
];

const flatMenuItems = [...commandMenuItems, ...growthMenuItems, ...dataMenuItems, ...helpMenuItems];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const token = theme.useToken().token;
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const selectedKey = flatMenuItems.find((item) => typeof item.key === "string" && location.pathname.startsWith(item.key))?.key ?? "/app/dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const selectedLabel = flatMenuItems.find((item) => item.key === selectedKey)?.label ?? "AI-HRMS";

  useEffect(() => {
    let mounted = true;
    api.providerStatus()
      .then((status) => { if (mounted) setProviderStatus(status); })
      .catch(() => { if (mounted) setProviderStatus(null); });
    return () => { mounted = false; };
  }, []);

  const handleMenuClick = (key: string) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  return (
    <Layout className="app-shell" data-vc-shell="app" data-vc-kind="app-shell" data-suite-mode={demoMode ? "demo" : "real"}>
      <Sider breakpoint="lg" collapsedWidth={0} className="app-sider">
        <div className="brand">
          <TeamOutlined />
          <span>AI-HRMS</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={(item) => handleMenuClick(item.key)}
          data-vc-kind="main-navigation"
        />
      </Sider>
      <Layout>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <Button className="mobile-menu-button" type="text" icon={<MenuOutlined />} aria-label="打开导航菜单" title="打开导航菜单" onClick={() => setMobileMenuOpen(true)} />
          <div className="app-header-title">
            <Typography.Text strong>Human-Agent Symbiotic HR Operating System</Typography.Text>
            {demoMode ? <Tag color="blue">Demo environment</Tag> : null}
            <Tag color={providerStatus?.chatProvider === "deepseek" ? "geekblue" : "default"}>
              AI {providerStatus?.chatProvider ?? "boundary"} / RAG {providerStatus?.embeddingProvider ?? "unknown"}
            </Tag>
          </div>
          <Typography.Text className="mobile-route-title" strong>{selectedLabel}</Typography.Text>
          <Dropdown
            menu={{
              items: [
                { key: "roles", label: `角色：${user?.roles?.join(", ") || "未分配"}` },
                { key: "logout", danger: true, label: "退出登录" },
              ],
              onClick: ({ key }) => {
                if (key === "logout") {
                  logout();
                  navigate("/login");
                }
              },
            }}
          >
            <Button type="text" className="user-button">
              <Avatar size="small" icon={<UserOutlined />} />
              {user?.username}
            </Button>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Alert
            className="demo-boundary-banner"
            type="info"
            showIcon
            title="当前组织、员工、制度和审计均为虚构样本企业数据"
            description="企鹅互联网科技有限公司只用于承载 AI-HRMS 演示流程；不是腾讯，也不是任何真实公司的 HR 数据。"
          />
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <Drawer
        title="AI-HRMS Navigation"
        placement="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        size="default"
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={(item) => handleMenuClick(item.key)}
        />
      </Drawer>
    </Layout>
  );
}
