import { App as AntApp, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { AppSettingsProvider, useAppSettings } from "./AppSettingsContext";
import { AppRouter } from "./AppRouter";

export function RootApp() {
  return (
    <AppSettingsProvider>
      <RootConfig />
    </AppSettingsProvider>
  );
}

function RootConfig() {
  const { settings } = useAppSettings();
  return (
    <ConfigProvider locale={settings.language === "en-US" ? enUS : zhCN} componentSize={settings.density === "compact" ? "small" : "middle"}>
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  );
}
