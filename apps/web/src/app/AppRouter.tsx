import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { PageLoading } from "../components/PageLoading";
import { VisualCopilotOverlay } from "../components/VisualCopilotOverlay";

const AppShell = lazy(() => import("../components/AppShell").then((module) => ({ default: module.AppShell })));
const LoginPage = lazy(() => import("../features/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LegalEntitiesPage = lazy(() => import("../features/legal-entities/LegalEntitiesPage").then((module) => ({ default: module.LegalEntitiesPage })));
const OrgUnitsPage = lazy(() => import("../features/org-units/OrgUnitsPage").then((module) => ({ default: module.OrgUnitsPage })));
const UsersPage = lazy(() => import("../features/users/UsersPage").then((module) => ({ default: module.UsersPage })));
const EmployeesPage = lazy(() => import("../features/employees/EmployeesPage").then((module) => ({ default: module.EmployeesPage })));
const AttendancePage = lazy(() => import("../features/employees/AttendancePage").then((module) => ({ default: module.AttendancePage })));
const MessagesPage = lazy(() => import("../features/employees/MessagesPage").then((module) => ({ default: module.MessagesPage })));
const AiCommandCenterPage = lazy(() => import("../features/ai-command/AiCommandCenterPage").then((module) => ({ default: module.AiCommandCenterPage })));
const KnowledgePage = lazy(() => import("../features/knowledge/KnowledgePage").then((module) => ({ default: module.KnowledgePage })));
const DocsLibraryPage = lazy(() => import("../features/docs/DocsLibraryPage").then((module) => ({ default: module.DocsLibraryPage })));
const DocsDocumentPage = lazy(() => import("../features/docs/DocsLibraryPage").then((module) => ({ default: module.DocsDocumentPage })));
const LearningPage = lazy(() => import("../features/learning/LearningPage").then((module) => ({ default: module.LearningPage })));
const CoGrowthPage = lazy(() => import("../features/co-growth/CoGrowthPage").then((module) => ({ default: module.CoGrowthPage })));
const AgentRunsPage = lazy(() => import("../features/agents/AgentRunsPage").then((module) => ({ default: module.AgentRunsPage })));
const AuditPage = lazy(() => import("../features/audit/AuditPage").then((module) => ({ default: module.AuditPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const HelpPage = lazy(() => import("../features/help/HelpPage").then((module) => ({ default: module.HelpPage })));

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <PageLoading fullPage />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function AuthenticatedWorkspace() {
  return (
    <>
      <Outlet />
      <VisualCopilotOverlay />
    </>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoading fullPage />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AuthenticatedWorkspace />}>
                <Route path="/co-growth" element={<CoGrowthPage />} />
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="legal-entities" element={<LegalEntitiesPage />} />
                  <Route path="org-units" element={<OrgUnitsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="employees" element={<EmployeesPage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="ai-command" element={<AiCommandCenterPage />} />
                  <Route path="knowledge" element={<KnowledgePage />} />
                  <Route path="docs" element={<DocsLibraryPage />} />
                  <Route path="docs/:id" element={<DocsDocumentPage />} />
                  <Route path="learning" element={<LearningPage />} />
                  <Route path="co-growth" element={<Navigate to="/co-growth" replace />} />
                  <Route path="agents" element={<AgentRunsPage />} />
                  <Route path="audit" element={<AuditPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="help" element={<HelpPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
