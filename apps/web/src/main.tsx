import "antd/dist/reset.css";
import "./styles/global.css";

import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { PageLoading } from "./components/PageLoading";

const RootApp = lazy(() => import("./app/RootApp").then((module) => ({ default: module.RootApp })));

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<PageLoading fullPage />}>
    <RootApp />
  </Suspense>,
);
