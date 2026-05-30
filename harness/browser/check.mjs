import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const realBaseURL = trimSlash(process.env.AI_HRMS_BROWSER_REAL_BASE_URL || "http://127.0.0.1:5173");
const demoBaseURL = trimSlash(process.env.AI_HRMS_BROWSER_DEMO_BASE_URL || "http://127.0.0.1:5174");
const backendOrigins = parseOrigins(process.env.AI_HRMS_BROWSER_BACKEND_ORIGINS || "http://127.0.0.1:8080,http://localhost:8080");
const username = process.env.AI_HRMS_BROWSER_USERNAME || "123";
const password = process.env.AI_HRMS_BROWSER_PASSWORD || "password";
const timeoutMs = Number(process.env.AI_HRMS_BROWSER_TIMEOUT_MS || 15000);
const skipReal = process.env.AI_HRMS_BROWSER_SKIP_REAL === "true";
const skipDemo = process.env.AI_HRMS_BROWSER_SKIP_DEMO === "true";
const headless = process.env.AI_HRMS_BROWSER_HEADFUL !== "true";

const pageChecks = [
  ["/app/dashboard", ["AI-HRMS", "Human-Agent Symbiotic"]],
  ["/app/ai-command", ["Agentic HR Command Center", "Human-Agent Policy"]],
  ["/app/knowledge", ["Governed Knowledge Hub", "RAG Search"]],
  ["/co-growth", ["Co-Growth OS", "AI-HRMS 人机共生成长引擎"]],
  ["/app/learning", ["Learning Layer", "Co-Growth OS"]],
  ["/app/agents", ["Human-Agent Run Center", "Agent run"]],
  ["/app/audit", ["Trust, Audit & Evidence Layer", "审计链路"]],
];

const results = [];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const chromium = await loadChromium();
  printEnvironment(chromium);

  const suites = [];
  if (!skipReal) suites.push({ name: "real", baseURL: realBaseURL, demo: false });
  if (!skipDemo) suites.push({ name: "demo", baseURL: demoBaseURL, demo: true });
  if (!suites.length) {
    throw new Error("No browser suites enabled. Remove AI_HRMS_BROWSER_SKIP_REAL/DEMO or set one to false.");
  }

  const browser = await chromium.launch({ headless });
  try {
    for (const suite of suites) {
      await checkServerReachable(suite);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        locale: "zh-CN",
      });
      try {
        await runSuite(context, suite);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

async function loadChromium() {
  try {
    const playwright = await import("playwright");
    return playwright.chromium;
  } catch (error) {
    throw new Error(`Playwright is not available. Run npm install and npm exec playwright install chromium. Detail: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function printEnvironment(chromium) {
  const systemChromium = findSystemChromium();
  const cache = findPlaywrightChromiumCache();
  console.log("Browser harness environment:");
  console.log(`- playwright package: ${resolvePackage("playwright") ? "installed" : "missing"}`);
  console.log(`- @playwright/test package: ${resolvePackage("@playwright/test") ? "installed" : "missing"}`);
  console.log(`- system chromium/chrome: ${systemChromium || "not found on PATH"}`);
  console.log(`- playwright chromium cache: ${cache.length ? cache.join(", ") : "not found"}`);
  console.log(`- playwright chromium executable: ${safeExecutablePath(chromium) || "not resolved"}`);
}

function resolvePackage(packageName) {
  try {
    return execFileSync(process.execPath, ["-e", `console.log(require.resolve(${JSON.stringify(packageName)}))`], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function findSystemChromium() {
  const candidates = process.platform === "win32"
    ? ["chrome.exe", "msedge.exe"]
    : ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  for (const candidate of candidates) {
    try {
      const command = process.platform === "win32" ? "where" : "bash";
      const args = process.platform === "win32" ? [candidate] : ["-lc", `command -v ${candidate}`];
      return execFileSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().split(/\r?\n/)[0];
    } catch {
      // Keep checking other candidates.
    }
  }
  return "";
}

function findPlaywrightChromiumCache() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0" ? process.env.PLAYWRIGHT_BROWSERS_PATH : "",
    defaultPlaywrightCacheRoot(),
    join(homedir(), ".cache", "ms-playwright"),
  ].filter(Boolean);
  return Array.from(new Set(roots)).flatMap((cacheRoot) => {
    if (!existsSync(cacheRoot)) return [];
    return readdirSync(cacheRoot)
      .filter((entry) => entry.startsWith("chromium"))
      .map((entry) => join(cacheRoot, entry));
  }).sort();
}

function defaultPlaywrightCacheRoot() {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "ms-playwright") : "";
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", "ms-playwright");
  }
  return join(homedir(), ".cache", "ms-playwright");
}

function safeExecutablePath(chromium) {
  try {
    return chromium.executablePath();
  } catch {
    return "";
  }
}

async function checkServerReachable({ name, baseURL }) {
  try {
    const response = await fetch(baseURL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok && response.status !== 404) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`[${name}] frontend is not reachable at ${baseURL}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runSuite(context, suite) {
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, suite);
  const visited = [];

  await goto(page, suite, "/login");
  await assertText(page, suite, "/login", ["AI-HRMS", "人机共生"]);
  visited.push("/login");

  await ensureAuthenticated(page, suite);

  for (const [path, markers] of pageChecks) {
    await goto(page, suite, path);
    await assertText(page, suite, path, markers);
    visited.push(path);
  }

  await checkVisualCopilot(page, suite, "/app/dashboard");
  await checkVisualCopilot(page, suite, "/co-growth");

  await page.close();
  diagnostics.assertClean();

  results.push({
    suite: suite.name,
    baseURL: suite.baseURL,
    visited,
    backendApiRequests: diagnostics.backendApiRequests,
    consoleErrors: diagnostics.consoleErrors.length,
    requestFailures: diagnostics.requestFailures.length,
    httpFailures: diagnostics.httpFailures.length,
  });
}

function attachDiagnostics(page, suite) {
  const consoleErrors = [];
  const requestFailures = [];
  const httpFailures = [];
  let backendApiRequests = 0;

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isIgnorableConsoleError(text)) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("request", (request) => {
    if (isBackendRequest(request.url())) {
      backendApiRequests += 1;
    }
  });

  page.on("response", (response) => {
    if (response.status() < 400 || isIgnorableHTTPFailure(response.url())) return;
    httpFailures.push(`${response.status()} ${response.url()}`);
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown failure";
    if (isIgnorableRequestFailure(request.url(), failure)) return;
    requestFailures.push(`${request.url()} :: ${failure}`);
  });

  return {
    consoleErrors,
    requestFailures,
    httpFailures,
    get backendApiRequests() {
      return backendApiRequests;
    },
    assertClean() {
      const failures = [];
      if (consoleErrors.length) failures.push(`console/page errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
      if (requestFailures.length) failures.push(`request failures: ${requestFailures.slice(0, 5).join(" | ")}`);
      if (httpFailures.length) failures.push(`HTTP failures: ${httpFailures.slice(0, 5).join(" | ")}`);
      if (suite.demo && backendApiRequests > 0) failures.push(`demo suite made ${backendApiRequests} backend API request(s)`);
      if (failures.length) {
        throw new Error(`[${suite.name}] browser diagnostics failed: ${failures.join("; ")}`);
      }
    },
  };
}

async function goto(page, suite, path) {
  await page.goto(`${suite.baseURL}${path}`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForSelector("#root", { timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  const rootText = await page.locator("#root").innerText({ timeout: timeoutMs });
  if (rootText.replace(/\s+/g, "").length < 20) {
    throw new Error(`[${suite.name}] ${path} looks blank`);
  }
}

async function ensureAuthenticated(page, suite) {
  await goto(page, suite, "/app/dashboard");
  if (!new URL(page.url()).pathname.startsWith("/login")) return;

  await page.getByPlaceholder("手机号").fill(username);
  await page.getByPlaceholder("密码").fill(password);
  await page.getByRole("button", { name: /进入操作系统|一键进入/ }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: timeoutMs });
  await page.waitForFunction(() => document.body.innerText.includes("AI-HRMS"), null, { timeout: timeoutMs });
  await assertText(page, suite, "post-login", ["AI-HRMS"]);
}

async function assertText(page, suite, path, markers) {
  const text = await page.locator("#root").innerText({ timeout: timeoutMs });
  const missing = markers.filter((marker) => !text.includes(marker));
  if (missing.length) {
    throw new Error(`[${suite.name}] ${path} missing expected page marker(s): ${missing.join(", ")}`);
  }
}

async function checkVisualCopilot(page, suite, path) {
  await goto(page, suite, path);
  await page.locator("[data-vc-action='visual_copilot.toggle']").click({ timeout: timeoutMs });
  const panel = page.locator("[data-vc-kind='visual-copilot-panel']");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await panel.getByText("Visual Copilot", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await panel.getByText("不做图片识别").waitFor({ state: "visible", timeout: timeoutMs });
  await page.keyboard.press("Escape");
  await page.locator("[data-vc-kind='visual-copilot-panel']").waitFor({ state: "detached", timeout: timeoutMs });
}

function isBackendRequest(rawURL) {
  try {
    const url = new URL(rawURL);
    return backendOrigins.has(url.origin) || url.pathname === "/api" || url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isIgnorableConsoleError(text) {
  return text.includes("ResizeObserver loop completed with undelivered notifications");
}

function isIgnorableRequestFailure(rawURL, failure) {
  if (!failure.includes("ERR_ABORTED")) return false;
  try {
    const url = new URL(rawURL);
    return url.pathname.startsWith("/src/") || url.pathname.startsWith("/@vite/") || url.search.includes("t=");
  } catch {
    return false;
  }
}

function isIgnorableHTTPFailure(rawURL) {
  try {
    const url = new URL(rawURL);
    return url.pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

function parseOrigins(value) {
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    try {
      return new URL(item).origin;
    } catch {
      return "";
    }
  }).filter(Boolean));
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}
