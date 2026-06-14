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
  AppstoreOutlined,
  BellOutlined,
  MenuOutlined,
  IdcardOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Badge, Button, Drawer, Dropdown, Input, Layout, Menu, Popover, Space, Tag, theme, Typography } from "antd";
import { Suspense, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { HRWorkItem } from "../api/types";
import { clampSidebarWidth, useAppSettings } from "../app/AppSettingsContext";
import { useAuth } from "../app/AuthContext";
import { useI18n } from "../i18n";
import { PageLoading } from "./PageLoading";
import { workItemRoute } from "../features/work-domains/hrNavigation";

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
    const bigMenuItems = [
      { key: "/app/dashboard", icon: <DashboardOutlined />, label: t("shell.nav.dashboard") },
      { key: "/app/org-people", icon: <ApartmentOutlined />, label: t("shell.nav.orgPeople") },
      { key: "/app/employee-ops", icon: <ClockCircleOutlined />, label: t("shell.nav.employeeOps") },
      { key: "/app/recruitment-lifecycle", icon: <TeamOutlined />, label: t("shell.nav.recruitmentLifecycle") },
      { key: "/app/growth-performance", icon: <ExperimentOutlined />, label: t("shell.nav.growthPerformance") },
      { key: "/app/knowledge-agent", icon: <RobotOutlined />, label: t("shell.nav.knowledgeAgent") },
      { key: "/app/trust-audit", icon: <AuditOutlined />, label: t("shell.nav.trustAudit") },
      { key: "/app/settings", icon: <SettingOutlined />, label: t("shell.nav.settings") },
    ];
    return {
      menuItems: [{ type: "group" as const, label: t("shell.groups.operating"), children: bigMenuItems }],
      flatMenuItems: bigMenuItems,
    };
  }, [t]);
  const legacySelectedKey = useMemo(() => {
    const legacyMap = [
      { key: "/app/org-people", paths: ["/app/legal-entities", "/app/org-units", "/app/users", "/app/employees"] },
      { key: "/app/employee-ops", paths: ["/app/attendance", "/app/messages"] },
      { key: "/app/recruitment-lifecycle", paths: ["/app/recruitment"] },
      { key: "/app/growth-performance", paths: ["/app/learning", "/co-growth"] },
      { key: "/app/knowledge-agent", paths: ["/app/ai-command", "/app/knowledge", "/app/docs", "/app/agents"] },
      { key: "/app/trust-audit", paths: ["/app/audit"] },
      { key: "/app/settings", paths: ["/app/help", "/app/profile"] },
    ];
    return legacyMap.find((item) => item.paths.some((path) => location.pathname.startsWith(path)))?.key;
  }, [location.pathname]);
  const selectedKey = legacySelectedKey ?? flatMenuItems.find((item) => typeof item.key === "string" && location.pathname.startsWith(item.key))?.key ?? "/app/dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [workItems, setWorkItems] = useState<HRWorkItem[]>([]);
  const [workItemTotal, setWorkItemTotal] = useState(0);
  const selectedLabel = location.pathname.startsWith("/app/profile") ? t("shell.profile") : flatMenuItems.find((item) => item.key === selectedKey)?.label ?? "AI-HRMS";
  const appGridItems = [
    { key: "/app/ai-command", icon: <RobotOutlined />, label: t("shell.nav.aiCommand") },
    { key: "/app/knowledge", icon: <DatabaseOutlined />, label: t("shell.nav.knowledge") },
    { key: "/app/docs", icon: <FileTextOutlined />, label: t("shell.nav.docs") },
    { key: "/app/agents", icon: <TeamOutlined />, label: t("shell.nav.agents") },
    { key: "/app/audit", icon: <AuditOutlined />, label: t("shell.nav.audit") },
    { key: "/app/legal-entities", icon: <BankOutlined />, label: t("shell.nav.legalEntities") },
    { key: "/app/org-units", icon: <ApartmentOutlined />, label: t("shell.nav.orgUnits") },
    { key: "/app/employees", icon: <IdcardOutlined />, label: t("shell.nav.employees") },
    { key: "/app/attendance", icon: <ClockCircleOutlined />, label: t("shell.nav.attendance") },
    { key: "/app/learning", icon: <BookOutlined />, label: t("shell.nav.learning") },
    { key: "/app/help", icon: <QuestionCircleOutlined />, label: t("shell.nav.help") },
  ];

  useEffect(() => {
    let mounted = true;
    api.workbenchWorkItems(1, 6)
      .then((result) => {
        if (!mounted) return;
        setWorkItems(result.rows ?? []);
        setWorkItemTotal(result.total ?? 0);
      })
      .catch(() => {
        if (!mounted) return;
        setWorkItems([]);
        setWorkItemTotal(0);
      });
    return () => { mounted = false; };
  }, [location.pathname]);

  useEffect(() => {
    const labelPaginationButtons = () => {
      document.querySelectorAll<HTMLButtonElement>(".ant-pagination-prev .ant-pagination-item-link").forEach((button) => {
        button.setAttribute("aria-label", t("shell.previousPage"));
        button.setAttribute("title", t("shell.previousPage"));
      });
      document.querySelectorAll<HTMLButtonElement>(".ant-pagination-next .ant-pagination-item-link").forEach((button) => {
        button.setAttribute("aria-label", t("shell.nextPage"));
        button.setAttribute("title", t("shell.nextPage"));
      });
    };
    labelPaginationButtons();
    const observer = new MutationObserver(labelPaginationButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [t, location.pathname]);

  const handleMenuClick = (key: string) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  const handleMobileAppClick = (key: string) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  const handleSearch = (value: string) => {
    const query = value.trim();
    if (!query) return;
    navigate(`/app/ai-command?q=${encodeURIComponent(query)}`);
  };

  const notificationContent = (
    <div className="notification-panel" data-vc-kind="notification-panel">
      <div className="notification-panel-header">
        <Typography.Text strong>{t("shell.notificationTitle")}</Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={() => {
            setNotificationOpen(false);
            navigate("/app/dashboard");
          }}
        >
          {t("shell.viewAll")}
        </Button>
      </div>
      {workItems.length ? (
        <ul className="notification-list" role="list">
          {workItems.map((item) => (
            <li className="notification-item" key={`${item.resource}-${item.id}`}>
              <div className="notification-item-main">
                <Space className="notification-item-title" size={6} wrap>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Tag color={item.riskLevel === "high" ? "red" : item.riskLevel === "medium" ? "orange" : "green"}>{item.riskLevel}</Tag>
                </Space>
                <Typography.Text type="secondary">
                  {item.employeeName || item.orgUnitName || item.recordType} · {item.action}
                </Typography.Text>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setNotificationOpen(false);
                  navigate(workItemRoute(item));
                }}
              >
                {t("shell.handleNow")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="notification-empty">{t("shell.noNotifications")}</div>
      )}
    </div>
  );

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
          <div className="app-header-title global-work-context">
            <Space size={8} wrap>
              <Typography.Text strong>{t("shell.yearMonth")}</Typography.Text>
              <Tag color="blue">{t("shell.hrPeriod")}</Tag>
              <Tag>{t("shell.scope")}</Tag>
            </Space>
          </div>
          <Typography.Text className="mobile-route-title" strong>{selectedLabel}</Typography.Text>
          <Input.Search className="global-search" placeholder={t("shell.searchPlaceholder")} allowClear enterButton={t("shell.searchButton")} onSearch={handleSearch} />
          <Popover
            trigger="click"
            placement="bottomRight"
            open={notificationOpen}
            onOpenChange={setNotificationOpen}
            content={notificationContent}
          >
            <Button
              type="text"
              className="notification-button"
              icon={<Badge count={workItemTotal} size="small" overflowCount={99}><BellOutlined /></Badge>}
              aria-label={t("shell.notifications")}
              title={t("shell.notifications")}
            />
          </Popover>
          <Dropdown
            menu={{
              items: appGridItems,
              onClick: ({ key }) => navigate(key),
            }}
          >
            <Button type="text" icon={<AppstoreOutlined />} aria-label={t("shell.appGrid")} title={t("shell.appGrid")} />
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: "profile", label: t("shell.profile") },
                { key: "roles", label: t("shell.roles", { roles: user?.roles?.join(", ") || t("shell.noRoles") }) },
                { key: "logout", danger: true, label: t("shell.logout") },
              ],
              onClick: ({ key }) => {
                if (key === "profile") {
                  navigate("/app/profile");
                  return;
                }
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
        <div className="mobile-drawer-tools">
          <Input.Search
            placeholder={t("shell.searchPlaceholder")}
            allowClear
            enterButton={t("shell.searchButton")}
            onSearch={(value) => {
              handleSearch(value);
              setMobileMenuOpen(false);
            }}
          />
          <div className="mobile-app-shortcuts" data-vc-kind="mobile-app-shortcuts">
            <Typography.Text type="secondary">{t("shell.appGrid")}</Typography.Text>
            <div className="mobile-app-shortcut-grid">
              {appGridItems.slice(0, 6).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="mobile-app-shortcut"
                  onClick={() => handleMobileAppClick(item.key)}
                  data-vc-kind="mobile-app-shortcut"
                  data-vc-label={String(item.label)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
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
