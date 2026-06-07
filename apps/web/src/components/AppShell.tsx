import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  MenuOutlined,
  IdcardOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Tag, theme, Typography } from "antd";
import { Suspense, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AIProviderStatus } from "../api/types";
import { clampSidebarWidth, useAppSettings } from "../app/AppSettingsContext";
import { useAuth } from "../app/AuthContext";
import { useI18n } from "../i18n";
import { PageLoading } from "./PageLoading";

const { Header, Sider, Content } = Layout;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings, setSidebarWidth } = useAppSettings();
  const { t } = useI18n();
  const token = theme.useToken().token;
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const { menuItems, flatMenuItems } = useMemo(() => {
    const commandMenuItems = [
      { key: "/app/dashboard", icon: <DashboardOutlined />, label: t("shell.nav.dashboard") },
      { key: "/app/ai-command", icon: <RobotOutlined />, label: t("shell.nav.aiCommand") },
      { key: "/app/agents", icon: <TeamOutlined />, label: t("shell.nav.agents") },
    ];
    const knowledgeMenuItems = [
      { key: "/app/knowledge", icon: <DatabaseOutlined />, label: t("shell.nav.knowledge") },
      { key: "/app/docs", icon: <FileTextOutlined />, label: t("shell.nav.docs") },
      { key: "/app/audit", icon: <AuditOutlined />, label: t("shell.nav.audit") },
    ];
    const growthMenuItems = [
      { key: "/co-growth", icon: <ExperimentOutlined />, label: t("shell.nav.coGrowth") },
      { key: "/app/learning", icon: <BookOutlined />, label: t("shell.nav.learning") },
    ];
    const dataMenuItems = [
      { key: "/app/legal-entities", icon: <BankOutlined />, label: t("shell.nav.legalEntities") },
      { key: "/app/org-units", icon: <ApartmentOutlined />, label: t("shell.nav.orgUnits") },
      { key: "/app/users", icon: <UserOutlined />, label: t("shell.nav.users") },
      { key: "/app/employees", icon: <IdcardOutlined />, label: t("shell.nav.employees") },
      { key: "/app/attendance", icon: <ClockCircleOutlined />, label: t("shell.nav.attendance") },
      { key: "/app/messages", icon: <MessageOutlined />, label: t("shell.nav.messages") },
    ];
    const supportMenuItems = [
      { key: "/app/settings", icon: <SettingOutlined />, label: t("shell.nav.settings") },
      { key: "/app/help", icon: <QuestionCircleOutlined />, label: t("shell.nav.help") },
    ];
    return {
      menuItems: [
        { type: "group" as const, label: t("shell.groups.operating"), children: commandMenuItems },
        { type: "group" as const, label: t("shell.groups.knowledge"), children: knowledgeMenuItems },
        { type: "group" as const, label: t("shell.groups.growth"), children: growthMenuItems },
        { type: "group" as const, label: t("shell.groups.data"), children: dataMenuItems },
        { type: "group" as const, label: t("shell.groups.support"), children: supportMenuItems },
      ],
      flatMenuItems: [...commandMenuItems, ...knowledgeMenuItems, ...growthMenuItems, ...dataMenuItems, ...supportMenuItems],
    };
  }, [t]);
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

  const beginSidebarResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = settings.sidebarWidth;
    const pointerID = event.pointerId;
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerID) return;
      setSidebarWidth(startWidth + pointer.clientX - startX);
    };
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done, { once: true });
    window.addEventListener("pointercancel", done, { once: true });
  };

  const resizeSidebarByKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (event.key === "Home") {
      setSidebarWidth(240);
    } else if (event.key === "End") {
      setSidebarWidth(420);
    } else {
      setSidebarWidth(settings.sidebarWidth + (event.key === "ArrowRight" ? 12 : -12));
    }
  };

  return (
    <Layout className="app-shell" data-vc-shell="app" data-vc-kind="app-shell" data-suite-mode={demoMode ? "demo" : "real"}>
      <Sider breakpoint="lg" collapsedWidth={0} width={settings.sidebarWidth} className="app-sider">
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
        <button
          type="button"
          className="app-sider-resize-handle"
          aria-label={t("shell.resizeSidebar")}
          aria-valuemin={240}
          aria-valuemax={420}
          aria-valuenow={clampSidebarWidth(settings.sidebarWidth)}
          title={t("shell.resizeSidebar")}
          onPointerDown={beginSidebarResize}
          onKeyDown={resizeSidebarByKeyboard}
        />
      </Sider>
      <Layout>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <Button className="mobile-menu-button" type="text" icon={<MenuOutlined />} aria-label={t("shell.openNav")} title={t("shell.openNav")} onClick={() => setMobileMenuOpen(true)} />
          <div className="app-header-title">
            <Typography.Text strong>{t("shell.subtitle")}</Typography.Text>
            {demoMode ? <Tag color="blue">{t("shell.demoEnvironment")}</Tag> : null}
            <Tag color={providerStatus?.chatProvider === "deepseek" ? "geekblue" : "default"}>
              {t("shell.aiBoundary", { chat: providerStatus?.chatProvider ?? "boundary", rag: providerStatus?.embeddingProvider ?? "unknown" })}
            </Tag>
          </div>
          <Typography.Text className="mobile-route-title" strong>{selectedLabel}</Typography.Text>
          <Dropdown
            menu={{
              items: [
                { key: "roles", label: t("shell.roles", { roles: user?.roles?.join(", ") || t("shell.noRoles") }) },
                { key: "logout", danger: true, label: t("shell.logout") },
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
      <Drawer
        title={t("shell.navigation")}
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
