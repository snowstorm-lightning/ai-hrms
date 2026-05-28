import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  IdcardOutlined,
  MessageOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Dropdown, Layout, Menu, theme, Typography } from "antd";
import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { PageLoading } from "./PageLoading";
import { VisualCopilotOverlay } from "./VisualCopilotOverlay";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/app/dashboard", icon: <DashboardOutlined />, label: "工作台" },
  { key: "/app/legal-entities", icon: <BankOutlined />, label: "法人实体" },
  { key: "/app/org-units", icon: <ApartmentOutlined />, label: "组织单元" },
  { key: "/app/users", icon: <UserOutlined />, label: "用户管理" },
  { key: "/app/employees", icon: <IdcardOutlined />, label: "员工管理" },
  { key: "/app/attendance", icon: <ClockCircleOutlined />, label: "考勤管理" },
  { key: "/app/messages", icon: <MessageOutlined />, label: "消息社区" },
  { key: "/app/ai-command", icon: <RobotOutlined />, label: "AI 指挥中心" },
  { key: "/app/knowledge", icon: <DatabaseOutlined />, label: "知识库" },
  { key: "/app/learning", icon: <BookOutlined />, label: "学习中心" },
  { key: "/co-growth", icon: <ExperimentOutlined />, label: "共进学习舱" },
  { key: "/app/agents", icon: <TeamOutlined />, label: "Agent 运行" },
  { key: "/app/audit", icon: <AuditOutlined />, label: "审计中心" },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const token = theme.useToken().token;

  return (
    <Layout className="app-shell" data-vc-shell="app" data-vc-kind="app-shell">
      <Sider breakpoint="lg" collapsedWidth={0} className="app-sider">
        <div className="brand">
          <TeamOutlined />
          <span>AI HRMS</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? "/app/dashboard"]}
          items={menuItems}
          onClick={(item) => navigate(item.key)}
          data-vc-kind="main-navigation"
        />
      </Sider>
      <Layout>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <Typography.Text type="secondary">集团型人力资源管理系统</Typography.Text>
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
    </Layout>
  );
}
