import { ColumnWidthOutlined, GlobalOutlined, RobotOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Radio, Segmented, Slider, Space, Switch, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../api/client";
import type { AIProviderStatus } from "../../api/types";
import { useAppSettings, defaultSidebarWidth, maxSidebarWidth, minSidebarWidth, type LanguageCode } from "../../app/AppSettingsContext";
import { useAuth } from "../../app/AuthContext";
import { useI18n, languageOptions } from "../../i18n";
import { PageTitle } from "../../components/PageTitle";

export function SettingsPage() {
  const { settings, updateSettings, setLanguage, setSidebarWidth, resetSettings, resetSidebarWidth } = useAppSettings();
  const { user } = useAuth();
  const { t } = useI18n();
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    api.providerStatus()
      .then((status) => { if (mounted) setProviderStatus(status); })
      .catch(() => { if (mounted) setProviderStatus(null); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="settings-page" data-vc-page="settings">
      <PageTitle title={t("settings.title")} description={t("settings.description")} />

      <section className="settings-grid">
        <Card title={<SettingsCardTitle icon={<GlobalOutlined />} text={t("settings.languageTitle")} />} data-vc-kind="settings-language">
          <Space orientation="vertical" size="middle" className="settings-section-body">
            <Typography.Paragraph type="secondary">{t("settings.languageDescription")}</Typography.Paragraph>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={settings.language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              options={languageOptions}
              aria-label={t("settings.languageLabel")}
            />
          </Space>
        </Card>

        <Card title={<SettingsCardTitle icon={<SafetyCertificateOutlined />} text={t("settings.interfaceTitle")} />} data-vc-kind="settings-interface">
          <Space orientation="vertical" size="large" className="settings-section-body">
            <div className="settings-row">
              <div>
                <Typography.Text strong>{t("settings.density")}</Typography.Text>
              </div>
              <Segmented
                value={settings.density}
                onChange={(value) => updateSettings({ density: value === "compact" ? "compact" : "comfortable" })}
                options={[
                  { label: t("settings.comfortable"), value: "comfortable" },
                  { label: t("settings.compact"), value: "compact" },
                ]}
              />
            </div>
            <div className="settings-row">
              <Typography.Text strong>{t("settings.showDemoBanner")}</Typography.Text>
              <Switch checked={settings.showDemoBanner} onChange={(checked) => updateSettings({ showDemoBanner: checked })} />
            </div>
          </Space>
        </Card>

        <Card title={<SettingsCardTitle icon={<ColumnWidthOutlined />} text={t("settings.navigationTitle")} />} data-vc-kind="settings-navigation">
          <Space orientation="vertical" size="middle" className="settings-section-body">
            <div className="settings-row">
              <Typography.Text strong>{t("settings.sidebarWidth")}</Typography.Text>
              <Tag>{settings.sidebarWidth}px</Tag>
            </div>
            <Slider min={minSidebarWidth} max={maxSidebarWidth} step={4} value={settings.sidebarWidth} onChange={setSidebarWidth} />
            <Space>
              <Button onClick={resetSidebarWidth}>{t("settings.resetWidth")}</Button>
              <Tag color="default">default={defaultSidebarWidth}px</Tag>
            </Space>
          </Space>
        </Card>

        <Card title={<SettingsCardTitle icon={<RobotOutlined />} text={t("settings.copilotTitle")} />} data-vc-kind="settings-copilot">
          <Space orientation="vertical" size="large" className="settings-section-body">
            <div className="settings-row">
              <Typography.Text strong>{t("settings.copilotMode")}</Typography.Text>
              <Segmented
                value={settings.copilotDefaultMode}
                onChange={(value) => updateSettings({ copilotDefaultMode: value === "screenshot" ? "screenshot" : "chat" })}
                options={[
                  { label: t("settings.copilotChat"), value: "chat" },
                  { label: t("settings.copilotScreenshot"), value: "screenshot" },
                ]}
              />
            </div>
            <div className="settings-row">
              <Typography.Text strong>{t("settings.copilotEvidence")}</Typography.Text>
              <Switch checked={settings.copilotEvidenceDefaultOpen} onChange={(checked) => updateSettings({ copilotEvidenceDefaultOpen: checked })} />
            </div>
          </Space>
        </Card>

        <Card title={<SettingsCardTitle icon={<UserOutlined />} text={t("settings.accountTitle")} />} className="settings-account-card" data-vc-kind="settings-account-runtime">
          <Descriptions column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label={t("settings.currentUser")}>{user?.username ?? "-"}</Descriptions.Item>
            <Descriptions.Item label={t("settings.roles")}>{user?.roles?.join(", ") || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("settings.providerStatus")}>
              <Space wrap>
                <Tag color={providerStatus?.chatProvider === "deepseek" ? "geekblue" : "default"}>AI={providerStatus?.chatProvider ?? "unknown"}</Tag>
                <Tag>RAG={providerStatus?.embeddingProvider ?? "unknown"}</Tag>
                <Tag>dim={providerStatus?.embeddingDimensions ?? "unknown"}</Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
          <Button className="settings-reset-button" danger onClick={resetSettings}>{t("settings.resetAll")}</Button>
        </Card>
      </section>
    </div>
  );
}

function SettingsCardTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Space>
      {icon}
      <span>{text}</span>
    </Space>
  );
}
