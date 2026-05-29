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
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Tag, theme, Typography } from "antd";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AIProviderStatus } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { PageLoading } from "./PageLoading";
import { VisualCopilotOverlay } from "./VisualCopilotOverlay";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/app/dashboard", icon: <DashboardOutlined />, label: "Command Dashboard" },
  { key: "/app/ai-command", icon: <RobotOutlined />, label: "AI 指挥中心" },
  { key: "/app/knowledge", icon: <DatabaseOutlined />, label: "Knowledge Hub" },
  { key: "/co-growth", icon: <ExperimentOutlined />, label: "Co-Growth OS" },
  { key: "/app/agents", icon: <TeamOutlined />, label: "Agent Run Center" },
  { key: "/app/audit", icon: <AuditOutlined />, label: "Audit & Evidence" },
  { type: "divider" as const },
  { key: "/app/learning", icon: <BookOutlined />, label: "Learning Layer" },
  { key: "/app/legal-entities", icon: <BankOutlined />, label: "法人实体" },
  { key: "/app/org-units", icon: <ApartmentOutlined />, label: "组织单元" },
  { key: "/app/users", icon: <UserOutlined />, label: "用户管理" },
  { key: "/app/employees", icon: <IdcardOutlined />, label: "员工管理" },
  { key: "/app/attendance", icon: <ClockCircleOutlined />, label: "考勤管理" },
  { key: "/app/messages", icon: <MessageOutlined />, label: "消息社区" },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const token = theme.useToken().token;
  const selectedKey = menuItems.find((item) => "key" in item && typeof item.key === "string" && location.pathname.startsWith(item.key))?.key ?? "/app/dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const selectedLabel = menuItems.find((item) => "key" in item && item.key === selectedKey)?.label ?? "AI-HRMS";

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
    <Layout className="app-shell" data-vc-shell="app" data-vc-kind="app-shell">
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
          <Button className="mobile-menu-button" type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} />
          <div className="app-header-title">
            <Typography.Text strong>Human-Agent Symbiotic HR Operating System</Typography.Text>
            {import.meta.env.VITE_DEMO_MODE === "true" ? <Tag color="blue">Demo environment</Tag> : null}
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
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <VisualCopilotOverlay />
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
