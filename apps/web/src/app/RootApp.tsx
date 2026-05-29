import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AppRouter } from "./AppRouter";

export function RootApp() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  );
}
