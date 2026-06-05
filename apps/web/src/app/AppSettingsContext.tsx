import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LanguageCode = "zh-CN" | "en-US";
export type InterfaceDensity = "comfortable" | "compact";
export type CopilotDefaultMode = "chat" | "screenshot";

export interface AppSettings {
  language: LanguageCode;
  sidebarWidth: number;
  density: InterfaceDensity;
  showDemoBanner: boolean;
  copilotDefaultMode: CopilotDefaultMode;
  copilotEvidenceDefaultOpen: boolean;
}

interface AppSettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setLanguage: (language: LanguageCode) => void;
  setSidebarWidth: (width: number) => void;
  resetSettings: () => void;
  resetSidebarWidth: () => void;
}

const settingsStorageKey = "ai-hrms.app-settings.v1";
export const defaultSidebarWidth = 320;
export const minSidebarWidth = 240;
export const maxSidebarWidth = 420;

const defaultSettings: AppSettings = {
  language: "zh-CN",
  sidebarWidth: defaultSidebarWidth,
  density: "comfortable",
  showDemoBanner: true,
  copilotDefaultMode: "chat",
  copilotEvidenceDefaultOpen: false,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => readStoredSettings());

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    } catch {
      // Some private browsing modes block localStorage; in-memory settings still work.
    }
  }, [settings]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.documentElement.dataset.density = settings.density;
  }, [settings.density, settings.language]);

  const value = useMemo<AppSettingsContextValue>(() => ({
    settings,
    updateSettings: (patch) => setSettings((current) => normalizeSettings({ ...current, ...patch })),
    setLanguage: (language) => setSettings((current) => ({ ...current, language })),
    setSidebarWidth: (width) => setSettings((current) => ({ ...current, sidebarWidth: clampSidebarWidth(width) })),
    resetSettings: () => setSettings(defaultSettings),
    resetSidebarWidth: () => setSettings((current) => ({ ...current, sidebarWidth: defaultSidebarWidth })),
  }), [settings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(AppSettingsContext);
  if (!value) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }
  return value;
}

function readStoredSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(settingsStorageKey);
    if (!raw) return defaultSettings;
    return normalizeSettings({ ...defaultSettings, ...JSON.parse(raw) });
  } catch {
    return defaultSettings;
  }
}

function normalizeSettings(value: AppSettings): AppSettings {
  return {
    language: value.language === "en-US" ? "en-US" : "zh-CN",
    sidebarWidth: clampSidebarWidth(value.sidebarWidth),
    density: value.density === "compact" ? "compact" : "comfortable",
    showDemoBanner: value.showDemoBanner !== false,
    copilotDefaultMode: value.copilotDefaultMode === "screenshot" ? "screenshot" : "chat",
    copilotEvidenceDefaultOpen: value.copilotEvidenceDefaultOpen === true,
  };
}

export function clampSidebarWidth(width: number) {
  if (!Number.isFinite(width)) return defaultSidebarWidth;
  return Math.min(Math.max(Math.round(width), minSidebarWidth), maxSidebarWidth);
}
