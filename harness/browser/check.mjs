import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const realBaseURL = trimSlash(process.env.AI_HRMS_BROWSER_REAL_BASE_URL || "http://127.0.0.1:5173");
const demoBaseURL = trimSlash(process.env.AI_HRMS_BROWSER_DEMO_BASE_URL || "http://127.0.0.1:5174");
const backendOrigins = parseOrigins(process.env.AI_HRMS_BROWSER_BACKEND_ORIGINS || "http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8020,http://localhost:8020");
const username = process.env.AI_HRMS_BROWSER_USERNAME || "12345678900";
const password = process.env.AI_HRMS_BROWSER_PASSWORD || "12345678900";
const timeoutMs = Number(process.env.AI_HRMS_BROWSER_TIMEOUT_MS || 15000);
const skipReal = process.env.AI_HRMS_BROWSER_SKIP_REAL === "true";
const skipDemo = process.env.AI_HRMS_BROWSER_SKIP_DEMO === "true";
const headless = process.env.AI_HRMS_BROWSER_HEADFUL !== "true";

const pageChecks = [
  ["/app/dashboard", ["AI-HRMS", "人机共生"]],
  ["/app/org-people", ["组织与员工", "组织入口"]],
  ["/app/employee-ops", ["员工事务", "个人考勤", "请求与审批"]],
  ["/app/recruitment-lifecycle", ["招聘与生命周期", "招聘公平性边界"]],
  ["/app/growth-performance", ["成长与绩效", "绩效只做证据化预览"]],
  ["/app/knowledge-agent", ["知识与智能体", "AI 指挥中心"]],
  ["/app/trust-audit", ["信任与审计", "人工复核队列"]],
  ["/app/ai-command", ["AI 指挥中心", "人机协作边界"]],
  ["/app/knowledge", ["治理型知识库", "引用回答"]],
  ["/app/docs", ["文档库", "按资料回答"]],
  ["/co-growth", ["AI-HRMS 共生成长引擎", "AI 能力画像"]],
  ["/app/learning", ["学习层", "进入共生成长"]],
  ["/app/agents", ["智能任务运行中心", "智能任务运行"]],
  ["/app/audit", ["信任、审计与证据层", "审计链路"]],
  ["/app/help", ["新手使用指南", "Visual Copilot 怎么用"]],
  ["/app/profile", ["个人简历", "履历摘要"]],
  ["/app/legal-entities", ["法人边界底座", "新增法人实体"]],
  ["/app/org-units", ["组织边界图谱", "新增组织单元"]],
  ["/app/users", ["账号与角色治理", "新增用户"]],
  ["/app/employees", ["员工数据层", "新增员工"]],
  ["/app/attendance", ["考勤实时态势台", "智能实时分析"]],
  ["/app/messages", ["消息与协作证据", "查看评论"]],
  ["/app/settings", ["设置", "侧边栏宽度"]],
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
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        locale: "zh-CN",
      });
      try {
        await runMobileEntrySuite(mobileContext, suite);
      } finally {
        await mobileContext.close();
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
  const blockedDemoBackendRequests = [];
  if (suite.demo) {
    await context.route("**/*", async (route) => {
      if (isBackendRequest(route.request().url())) {
        blockedDemoBackendRequests.push(route.request().url());
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
  }
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, suite);
  const visited = [];

  await goto(page, suite, "/login");
  await assertText(page, suite, "/login", ["AI-HRMS", "人机共生"]);
  visited.push("/login");

  await ensureAuthenticated(page, suite);
  await assertSuiteMode(page, suite);

  for (const [path, markers] of pageChecks) {
    await goto(page, suite, path);
    await assertText(page, suite, path, markers);
    visited.push(path);
  }
  if (suite.demo) {
    await goto(page, suite, "/app/docs/rag-doc-002");
    await assertText(page, suite, "/app/docs/rag-doc-002", ["新员工入职指南", "完整正文", "适用场景", "操作流程"]);
    visited.push("/app/docs/rag-doc-002");
  }

  await checkVisualCopilot(page, suite, "/app/knowledge", { requireBusinessRef: true });
  await checkVisualCopilot(page, suite, "/co-growth");
  await checkEmployeeMultiRowSelection(page, suite);
  await checkVisualCopilotDoesNotBlockModalInput(page, suite);
  await checkOrgUnitDeleteControls(page, suite);

  await page.close();
  diagnostics.assertClean();
  if (blockedDemoBackendRequests.length) {
    throw new Error(`[${suite.name}] blocked backend request(s): ${blockedDemoBackendRequests.slice(0, 5).join(" | ")}`);
  }

  results.push({
    suite: suite.name,
    baseURL: suite.baseURL,
    visited,
    backendApiRequests: diagnostics.backendApiRequests,
    consoleErrors: diagnostics.consoleErrors.length,
    consoleWarnings: diagnostics.consoleWarnings.length,
    requestFailures: diagnostics.requestFailures.length,
    httpFailures: diagnostics.httpFailures.length,
  });
}

async function runMobileEntrySuite(context, suite) {
  const blockedDemoBackendRequests = [];
  if (suite.demo) {
    await context.route("**/*", async (route) => {
      if (isBackendRequest(route.request().url())) {
        blockedDemoBackendRequests.push(route.request().url());
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
  }
  const mobileSuite = { ...suite, name: `${suite.name}-mobile` };
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, mobileSuite);
  try {
    await goto(page, mobileSuite, "/login");
    await ensureAuthenticated(page, mobileSuite);
    await assertSuiteMode(page, mobileSuite);
    await goto(page, mobileSuite, "/app/dashboard");
    const fab = page.locator("[data-vc-action='visual_copilot.toggle']");
    await fab.waitFor({ state: "visible", timeout: timeoutMs });
    const box = await fab.boundingBox({ timeout: timeoutMs });
    if (!box || box.width < 44 || box.height < 44 || box.x < 0 || box.y < 0) {
      throw new Error(`[${mobileSuite.name}] Visual Copilot FAB is not touch-accessible: ${JSON.stringify(box)}`);
    }
    await fab.click({ timeout: timeoutMs });
    const panel = page.locator("[data-vc-kind='visual-copilot-panel']");
    await panel.waitFor({ state: "visible", timeout: timeoutMs });
    await panel.getByRole("button", { name: "开始圈选" }).waitFor({ state: "visible", timeout: timeoutMs });
    await checkMobileVisualCopilotPanel(page, panel, mobileSuite);
    await panel.getByLabel("关闭 Visual Copilot").click({ timeout: timeoutMs });
    await panel.waitFor({ state: "detached", timeout: timeoutMs });
  } finally {
    await page.close();
  }
  diagnostics.assertClean();
  if (blockedDemoBackendRequests.length) {
    throw new Error(`[${mobileSuite.name}] blocked backend request(s): ${blockedDemoBackendRequests.slice(0, 5).join(" | ")}`);
  }
  results.push({
    suite: mobileSuite.name,
    baseURL: suite.baseURL,
    visited: ["/login", "/app/dashboard"],
    backendApiRequests: diagnostics.backendApiRequests,
    consoleErrors: diagnostics.consoleErrors.length,
    consoleWarnings: diagnostics.consoleWarnings.length,
    requestFailures: diagnostics.requestFailures.length,
    httpFailures: diagnostics.httpFailures.length,
  });
}

async function checkMobileVisualCopilotPanel(page, panel, suite) {
  const before = await panel.boundingBox({ timeout: timeoutMs });
  const dragHandle = panel.locator(".visual-panel-drag-handle");
  const dragBox = await dragHandle.boundingBox({ timeout: timeoutMs });
  if (!before || !dragBox || dragBox.width < 28 || dragBox.height < 28) {
    throw new Error(`[${suite.name}] Visual Copilot mobile drag handle is not usable: ${JSON.stringify(dragBox)}`);
  }
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2 + 48, { steps: 5 });
  await page.mouse.up();
  const moved = await panel.boundingBox({ timeout: timeoutMs });
  if (!moved || moved.y <= before.y + 12) {
    throw new Error(`[${suite.name}] Visual Copilot mobile panel did not move after drag`);
  }

  await panel.locator("button[title='收缩到可拖动窄侧栏，不拦截页面输入']").click({ timeout: timeoutMs });
  const rail = page.locator(".visual-copilot-rail");
  await rail.waitFor({ state: "visible", timeout: timeoutMs });
  const railBefore = await rail.boundingBox({ timeout: timeoutMs });
  const railHandle = rail.locator(".visual-rail-drag-handle");
  const railHandleBox = await railHandle.boundingBox({ timeout: timeoutMs });
  if (!railBefore || !railHandleBox || railHandleBox.width < 34 || railHandleBox.height < 34) {
    throw new Error(`[${suite.name}] Visual Copilot mobile rail handle is not usable: ${JSON.stringify(railHandleBox)}`);
  }
  await page.mouse.move(railHandleBox.x + railHandleBox.width / 2, railHandleBox.y + railHandleBox.height / 2);
  await page.mouse.down();
  const railDragX = railBefore.x < 180 ? railHandleBox.x + 82 : railHandleBox.x - 40;
  await page.mouse.move(railDragX, railHandleBox.y + 48, { steps: 5 });
  await page.mouse.up();
  const railAfter = await rail.boundingBox({ timeout: timeoutMs });
  if (!railAfter || Math.abs(railAfter.x - railBefore.x) < 12 || Math.abs(railAfter.y - railBefore.y) < 12) {
    throw new Error(`[${suite.name}] Visual Copilot mobile rail did not move after drag`);
  }
  await rail.getByLabel("展开 Visual Copilot").click({ timeout: timeoutMs });
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  const input = page.locator("[data-vc-field='visual_copilot.instruction']");
  await input.fill("移动端展开后仍可输入", { timeout: timeoutMs });
  const value = await input.inputValue({ timeout: timeoutMs });
  if (value !== "移动端展开后仍可输入") {
    throw new Error(`[${suite.name}] Visual Copilot mobile input was blocked after rail collapse/expand`);
  }
  await input.fill("", { timeout: timeoutMs });
}

function attachDiagnostics(page, suite) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const requestFailures = [];
  const httpFailures = [];
  const visualPayloadFailures = [];
  let backendApiRequests = 0;

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (isIgnorableConsoleMessage(text)) return;
    if (message.type() === "warning") {
      consoleWarnings.push(text);
      return;
    }
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("request", (request) => {
    if (isBackendRequest(request.url())) {
      backendApiRequests += 1;
    }
    if (request.method() === "POST") {
      const isVisual = request.url().includes("/visual-copilot/");
      const isAIChat = request.url().includes("/api/ai/chat");
      const contentType = request.headers()["content-type"] || "";
      const body = request.postData() || "";
      if (/multipart\/form-data|image\/(png|jpeg|webp)/i.test(contentType)) {
        visualPayloadFailures.push(`POST used image upload content-type: ${contentType}`);
      }
      if (/data:image|image\/(png|jpeg|webp)|base64/i.test(body)) {
        visualPayloadFailures.push("POST request body contained image/base64 payload");
      }
      if ((isVisual || isAIChat) && /\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|password|token|secret|api[_-]?key/i.test(body)) {
        visualPayloadFailures.push("Visual/AI request body contained sensitive raw identifier or secret-like text");
      }
      try {
        const payload = JSON.parse(body);
        if (payload.screenshot?.dataBase64) {
          visualPayloadFailures.push("POST request included raw screenshot image payload");
        }
        if (isVisual && (!Array.isArray(payload.dom) || !Array.isArray(payload.regions))) {
          visualPayloadFailures.push("Visual Copilot request did not carry DOM/regions context");
        }
      } catch {
        if (isVisual) {
          visualPayloadFailures.push("Visual Copilot request body was not JSON");
        }
      }
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
    consoleWarnings,
    requestFailures,
    httpFailures,
    get backendApiRequests() {
      return backendApiRequests;
    },
    assertClean() {
      const failures = [];
      if (consoleErrors.length) failures.push(`console/page errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
      if (consoleWarnings.length) failures.push(`console warnings: ${consoleWarnings.slice(0, 5).join(" | ")}`);
      if (requestFailures.length) failures.push(`request failures: ${requestFailures.slice(0, 5).join(" | ")}`);
      if (httpFailures.length) failures.push(`HTTP failures: ${httpFailures.slice(0, 5).join(" | ")}`);
      if (visualPayloadFailures.length) failures.push(`visual payload failures: ${visualPayloadFailures.slice(0, 5).join(" | ")}`);
      if (suite.demo && backendApiRequests > 0) failures.push(`demo suite made ${backendApiRequests} backend API request(s)`);
      if (!suite.demo && backendApiRequests === 0) failures.push("real suite made no backend API requests");
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

async function checkVisualCopilot(page, suite, path, options = {}) {
  await goto(page, suite, path);
  await page.locator("[data-vc-action='visual_copilot.toggle']").click({ timeout: timeoutMs });
  const panel = page.locator("[data-vc-kind='visual-copilot-panel']");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await panel.getByText("Visual Copilot", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  const role = await panel.getAttribute("role", { timeout: timeoutMs });
  if (role !== "dialog") {
    throw new Error(`[${suite.name}] ${path} Visual Copilot panel should expose dialog semantics`);
  }
  await panel.getByText("普通问答走知识库；截图/圈选问携带页面线索", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  if (await panel.getByText("换边").count()) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot should not expose a confusing side-switch button`);
  }
  await checkVisualPanelDragResize(page, panel, suite, path);
  await panel.getByRole("button", { name: "开始圈选" }).click({ timeout: timeoutMs });
  await assertVisualCaptureKeyboardContained(page, suite, path);
  let expectedBusinessRef = null;
  if (options.requireBusinessRef) {
    const target = page.locator("[data-vc-object-type][data-vc-object-id]:visible").first();
    expectedBusinessRef = {
      type: await target.getAttribute("data-vc-object-type", { timeout: timeoutMs }),
      id: await target.getAttribute("data-vc-object-id", { timeout: timeoutMs }),
    };
    const box = await target.boundingBox({ timeout: timeoutMs });
    if (!box) {
      throw new Error(`[${suite.name}] ${path} has no visible business object for Visual Copilot`);
    }
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.max(20, box.width - 4), box.y + Math.max(20, box.height - 4));
    await page.mouse.up();
  } else {
    await page.mouse.move(360, 170);
    await page.mouse.down();
    await page.mouse.move(720, 360);
    await page.mouse.up();
  }
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  if (options.requireBusinessRef) {
    await assertVisualRegionTracksBusinessObjectAfterScroll(page, suite, path);
  }
  await page.locator("[data-vc-field='visual_copilot.instruction']").fill("解释这一区域的业务含义和可执行边界");
  const visualRequest = expectedBusinessRef && !suite.demo
    ? page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/visual-copilot/suggestions"), { timeout: timeoutMs })
    : Promise.resolve(null);
  await panel.getByRole("button", { name: "提交" }).click({ timeout: timeoutMs });
  const capturedRequest = await visualRequest;
  if (capturedRequest && expectedBusinessRef) {
    assertVisualRequestContainsBusinessRef(capturedRequest, expectedBusinessRef, suite, path);
  }
  const visualResponseCard = panel.locator("[data-vc-kind='visual-copilot-response']");
  await visualResponseCard.locator(".visual-chat-answer").waitFor({ state: "visible", timeout: Math.max(timeoutMs, 30000) });
  await visualResponseCard.getByRole("button", { name: "详情" }).click({ timeout: timeoutMs });
  await visualResponseCard.locator(".visual-response-header").waitFor({ state: "visible", timeout: timeoutMs });
  await visualResponseCard.getByText(/selection-context|text-context|no-image-analysis|screenshot-hash-only/).waitFor({ state: "visible", timeout: timeoutMs });
  await visualResponseCard.locator("[data-vc-kind='visual-copilot-boundary']").getByText(/受控上下文|业务对象上下文解释|未上传页面截图/).waitFor({ state: "visible", timeout: timeoutMs });
  await visualResponseCard.getByText("执行思路与路径").waitFor({ state: "visible", timeout: timeoutMs });
  await visualResponseCard.getByRole("button", { name: /上下文证据/ }).waitFor({ state: "visible", timeout: timeoutMs });
  await panel.getByLabel("清空 Visual Copilot 内容").click({ timeout: timeoutMs });
  await page.getByText("Visual Copilot 已清空").waitFor({ state: "visible", timeout: timeoutMs });
  await visualResponseCard.waitFor({ state: "detached", timeout: timeoutMs });
  await panel.getByText("普通问答", { exact: true }).click({ timeout: timeoutMs });
  await panel.getByRole("button", { name: "询问" }).waitFor({ state: "visible", timeout: timeoutMs });
  const input = page.locator("[data-vc-field='visual_copilot.instruction']");
  await input.fill("这个页面怎么用", { timeout: timeoutMs });
  await panel.getByRole("button", { name: "询问" }).click({ timeout: timeoutMs });
  await panel.locator("[data-vc-kind='visual-page-chat']").waitFor({ state: "visible", timeout: Math.max(timeoutMs, 30000) });
  if (await panel.getByText(/历史记录/).count()) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot clear should remove previous turns from history`);
  }
  await input.fill("", { timeout: timeoutMs });
  await expectDisabled(panel.getByRole("button", { name: "询问" }), suite, path);
  await panel.getByLabel("关闭 Visual Copilot").click({ timeout: timeoutMs });
  await page.locator("[data-vc-kind='visual-copilot-panel']").waitFor({ state: "detached", timeout: timeoutMs });
}

async function checkEmployeeMultiRowSelection(page, suite) {
  const path = "/app/employees";
  await goto(page, suite, path);
  await page.locator("[data-vc-action='visual_copilot.toggle']").click({ timeout: timeoutMs });
  const panel = page.locator("[data-vc-kind='visual-copilot-panel']");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await panel.getByRole("button", { name: "开始圈选" }).click({ timeout: timeoutMs });
  await page.locator("[data-vc-kind='visual-copilot-rail']").waitFor({ state: "visible", timeout: timeoutMs });

  const rows = page.locator("[data-vc-object-type='employee'][data-vc-object-id]:visible");
  await rows.first().waitFor({ state: "visible", timeout: timeoutMs });
  const firstBox = await rows.nth(0).boundingBox({ timeout: timeoutMs });
  const secondBox = await rows.nth(1).boundingBox({ timeout: timeoutMs });
  if (!firstBox || !secondBox) {
    throw new Error(`[${suite.name}] ${path} cannot measure first two employee rows`);
  }
  const labels = [
    await rows.nth(0).getAttribute("data-vc-label", { timeout: timeoutMs }),
    await rows.nth(1).getAttribute("data-vc-label", { timeout: timeoutMs }),
  ].filter(Boolean);
  const rect = unionBoxes([firstBox, secondBox]);
  await page.mouse.move(rect.x + 8, rect.y + 8);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width - 8, rect.y + rect.height - 8, { steps: 6 });
  await page.mouse.up();
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await panel.getByText(/已选 2 名员工|2 名员工/).first().waitFor({ state: "visible", timeout: timeoutMs });
  const input = page.locator("[data-vc-field='visual_copilot.instruction']");
  await input.fill("给出这2个人的业务内容", { timeout: timeoutMs });
  const visualRequest = !suite.demo
    ? page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/visual-copilot/suggestions"), { timeout: timeoutMs })
    : Promise.resolve(null);
  const visualResponse = !suite.demo
    ? page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/visual-copilot/suggestions"), { timeout: Math.max(timeoutMs, 30000) })
    : Promise.resolve(null);
  await panel.getByRole("button", { name: "提交" }).click({ timeout: timeoutMs });
  const capturedRequest = await visualRequest;
  if (capturedRequest) {
    assertVisualRequestContainsEmployeeRefs(capturedRequest, suite, path);
    assertVisualRequestDoesNotLeakPeopleSecrets(capturedRequest, suite, path);
  }
  const capturedResponse = await visualResponse;
  if (capturedResponse) {
    const body = await capturedResponse.json();
    assertVisualEmployeeResponseQuality(body.data ?? body, labels, suite, path);
  }
  await panel.locator("[data-vc-kind='visual-copilot-response']").waitFor({ state: "visible", timeout: Math.max(timeoutMs, 30000) });
  const answerText = await panel.locator("[data-vc-kind='visual-copilot-response']").innerText({ timeout: timeoutMs });
  for (const label of labels) {
    if (!answerText.includes(label)) {
      throw new Error(`[${suite.name}] ${path} Visual employee answer missing selected employee ${label}: ${answerText.slice(0, 300)}`);
    }
  }
  if (!/业务内容|业务定位|归属|组织|法人|协同|风控|增长|平台|企业服务/.test(answerText)) {
    throw new Error(`[${suite.name}] ${path} Visual employee answer lacks business context: ${answerText.slice(0, 400)}`);
  }
  if (/页面上共有\s*\d+\s*个法人|当前权限范围内共有\s*\d+\s*个法人/.test(answerText)) {
    throw new Error(`[${suite.name}] ${path} Visual employee answer drifted to legal-entity listing: ${answerText.slice(0, 400)}`);
  }
  await panel.getByLabel("关闭 Visual Copilot").click({ timeout: timeoutMs });
  await page.locator("[data-vc-kind='visual-copilot-panel']").waitFor({ state: "detached", timeout: timeoutMs });
}

function assertVisualRequestContainsBusinessRef(request, expectedBusinessRef, suite, path) {
  const body = request.postData() || "";
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`[${suite.name}] ${path} Visual Copilot request was not JSON`);
  }
  const refs = Array.isArray(payload.regions)
    ? payload.regions.flatMap((region) => Array.isArray(region.businessRefs) ? region.businessRefs : [])
    : [];
  const matched = refs.some((ref) => ref && ref.type === expectedBusinessRef.type && ref.id === expectedBusinessRef.id);
  if (!matched) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot request did not include selected business ref ${expectedBusinessRef.type}:${expectedBusinessRef.id}`);
  }
}

function assertVisualRequestContainsEmployeeRefs(request, suite, path) {
  const payload = parseRequestJSON(request, suite, path);
  if (payload.route !== "/app/employees") {
    throw new Error(`[${suite.name}] ${path} employee Visual request route = ${payload.route}`);
  }
  const refs = Array.isArray(payload.regions)
    ? payload.regions.flatMap((region) => Array.isArray(region.businessRefs) ? region.businessRefs : [])
    : [];
  const employeeRefs = refs.filter((ref) => ref?.type === "employee");
  const ids = new Set(employeeRefs.map((ref) => ref.id));
  if (employeeRefs.length < 2 || ids.size < 2) {
    throw new Error(`[${suite.name}] ${path} expected at least 2 distinct employee refs, got ${JSON.stringify(refs)}`);
  }
  if (employeeRefs.length !== ids.size) {
    throw new Error(`[${suite.name}] ${path} employee refs should be deduped: ${JSON.stringify(employeeRefs)}`);
  }
}

function assertVisualRequestDoesNotLeakPeopleSecrets(request, suite, path) {
  const body = request.postData() || "";
  const forbidden = [
    /\b1[3-9]\d{9}\b/,
    /\b\d{17}[\dXx]\b/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /password|token|secret|api[_-]?key/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(body)) {
      throw new Error(`[${suite.name}] ${path} Visual request leaked sensitive pattern ${pattern}`);
    }
  }
}

function assertVisualEmployeeResponseQuality(body, labels, suite, path) {
  const explanation = String(body?.result?.explanation || "");
  const selectedSummary = String(body?.result?.selectedSummary || "");
  const combined = `${explanation}\n${selectedSummary}`;
  for (const label of labels) {
    if (!combined.includes(label)) {
      throw new Error(`[${suite.name}] ${path} Visual JSON answer missing selected employee ${label}: ${combined.slice(0, 400)}`);
    }
  }
  for (const marker of ["业务", "归属"]) {
    if (!combined.includes(marker)) {
      throw new Error(`[${suite.name}] ${path} Visual JSON answer missing ${marker}: ${combined.slice(0, 400)}`);
    }
  }
  if (!body?.executionDecision?.executionMode || !body?.contextPacket?.items?.length || !body?.trustPacket?.auditStatus) {
    throw new Error(`[${suite.name}] ${path} Visual JSON answer missing trust/execution/context packet`);
  }
}

function parseRequestJSON(request, suite, path) {
  const body = request.postData() || "";
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`[${suite.name}] ${path} Visual Copilot request was not JSON`);
  }
}

function unionBoxes(boxes) {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

async function assertVisualRegionTracksBusinessObjectAfterScroll(page, suite, path) {
  const target = page.locator("[data-vc-object-type][data-vc-object-id]:visible").first();
  const region = page.locator(".visual-region:not(.draft)").first();
  await region.waitFor({ state: "visible", timeout: timeoutMs });
  const before = await region.boundingBox({ timeout: timeoutMs });
  const targetBefore = await target.boundingBox({ timeout: timeoutMs });
  if (!before || !targetBefore) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot region or target could not be measured before scroll`);
  }
  const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 140);
  if (!canScroll) return;
  await page.evaluate(() => window.scrollBy({ top: 140, left: 0, behavior: "auto" }));
  await page.waitForTimeout(120);
  const after = await region.boundingBox({ timeout: timeoutMs });
  const targetAfter = await target.boundingBox({ timeout: timeoutMs });
  if (!after || !targetAfter) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot region or target could not be measured after scroll`);
  }
  const regionMoved = Math.abs(after.y - before.y) > 40;
  const targetMoved = Math.abs(targetAfter.y - targetBefore.y) > 40;
  const aligned = Math.abs(after.y - targetAfter.y) < 12 && Math.abs(after.x - targetAfter.x) < 12;
  if (!regionMoved || !targetMoved || !aligned) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot region did not track selected business object after scroll`);
  }
}

async function assertVisualCaptureKeyboardContained(page, suite, path) {
  const rail = page.locator("[data-vc-kind='visual-copilot-rail']");
  await rail.waitFor({ state: "visible", timeout: timeoutMs });
  await page.keyboard.press("Tab");
  const contained = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-vc-kind='visual-copilot-rail']")));
  if (!contained) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot capture mode allowed keyboard focus to escape to the page`);
  }
}

async function checkVisualPanelDragResize(page, panel, suite, path) {
  const before = await panel.boundingBox({ timeout: timeoutMs });
  if (!before) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot panel has no bounding box`);
  }
  const dragHandle = panel.locator(".visual-panel-drag-handle");
  const dragBox = await dragHandle.boundingBox({ timeout: timeoutMs });
  if (!dragBox) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot drag handle has no bounding box`);
  }
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x - 48, dragBox.y + 34, { steps: 6 });
  await page.mouse.up();
  const dragged = await panel.boundingBox({ timeout: timeoutMs });
  if (!dragged || Math.abs(dragged.x - before.x) < 12) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot panel did not move after drag`);
  }
  const resizeHandle = panel.locator(".visual-panel-resize-handle");
  const resizeBox = await resizeHandle.boundingBox({ timeout: timeoutMs });
  if (!resizeBox) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot resize handle has no bounding box`);
  }
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 52, resizeBox.y + 36, { steps: 6 });
  await page.mouse.up();
  const resized = await panel.boundingBox({ timeout: timeoutMs });
  if (!resized || resized.width < dragged.width + 12 || resized.height < dragged.height + 8) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot panel did not resize after dragging the handle`);
  }
  await resizeHandle.focus({ timeout: timeoutMs });
  await page.keyboard.press("Shift+ArrowRight");
  const keyboardResized = await panel.boundingBox({ timeout: timeoutMs });
  if (!keyboardResized || keyboardResized.width < resized.width + 10) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot resize handle did not support keyboard resizing`);
  }
  const input = page.locator("[data-vc-field='visual_copilot.instruction']");
  await input.fill("面板拖拽缩放后仍然可以输入", { timeout: timeoutMs });
  await input.focus({ timeout: timeoutMs });
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  const value = await input.inputValue({ timeout: timeoutMs });
  if (value !== "面板拖拽缩放后仍然可以输入") {
    throw new Error(`[${suite.name}] ${path} Visual Copilot input was blocked after drag/resize`);
  }
  await input.fill("", { timeout: timeoutMs });
}

async function checkVisualCopilotDoesNotBlockModalInput(page, suite) {
  const path = "/app/org-units";
  await goto(page, suite, path);
  await page.locator("[data-vc-action='visual_copilot.toggle']").click({ timeout: timeoutMs });
  const panel = page.locator("[data-vc-kind='visual-copilot-panel']");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await panel.locator("button[title='收缩到可拖动窄侧栏，不拦截页面输入']").click({ timeout: timeoutMs });
  await checkVisualRailDrag(page, suite, path);
  await page.locator("[data-vc-action='org_unit.create']").click({ timeout: timeoutMs });
  await page.locator("[data-vc-kind='org-unit-editor']").waitFor({ state: "visible", timeout: timeoutMs });
  const nameInput = page.locator("[data-vc-field='org_unit.name']").first();
  await nameInput.fill("AI 平台工程部", { timeout: timeoutMs });
  const value = await nameInput.inputValue({ timeout: timeoutMs });
  if (value !== "AI 平台工程部") {
    throw new Error(`[${suite.name}] ${path} Visual Copilot collapsed mode blocked modal input`);
  }
  await page.keyboard.press("Escape");
  await page.locator("[data-vc-kind='org-unit-editor']").waitFor({ state: "hidden", timeout: timeoutMs });
  await page.locator("[data-vc-kind='visual-copilot-rail']").waitFor({ state: "visible", timeout: timeoutMs });
  const closeVisual = page.getByLabel("关闭 Visual Copilot");
  if (await closeVisual.count()) {
    await closeVisual.click({ timeout: timeoutMs });
  }
}

async function checkOrgUnitDeleteControls(page, suite) {
  const path = "/app/org-units";
  await goto(page, suite, path);
  await page.locator("[data-vc-action='org_unit.create']").click({ timeout: timeoutMs });
  await page.locator("[data-vc-kind='org-unit-editor']").waitFor({ state: "visible", timeout: timeoutMs });
  await page.keyboard.press("Escape");
  await page.locator("[data-vc-kind='org-unit-editor']").waitFor({ state: "hidden", timeout: timeoutMs });
  await page.locator("[data-vc-action='org_unit.delete']").first().waitFor({ state: "visible", timeout: timeoutMs });
}

async function checkVisualRailDrag(page, suite, path) {
  const rail = page.locator(".visual-copilot-rail");
  await rail.waitFor({ state: "visible", timeout: timeoutMs });
  const before = await rail.boundingBox({ timeout: timeoutMs });
  const handle = rail.locator(".visual-rail-drag-handle");
  const handleBox = await handle.boundingBox({ timeout: timeoutMs });
  if (!before || !handleBox) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot rail cannot be measured`);
  }
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 54, { steps: 5 });
  await page.mouse.up();
  const after = await rail.boundingBox({ timeout: timeoutMs });
  if (!after || Math.abs(after.y - before.y) < 16) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot rail did not move after drag`);
  }
  await handle.focus({ timeout: timeoutMs });
  await page.keyboard.press("Shift+ArrowUp");
  const keyboardMoved = await rail.boundingBox({ timeout: timeoutMs });
  if (!keyboardMoved || keyboardMoved.y > after.y - 20) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot rail did not support keyboard movement`);
  }
}

async function assertSuiteMode(page, suite) {
  const mode = await page.locator("[data-suite-mode]").first().getAttribute("data-suite-mode", { timeout: timeoutMs }).catch(() => "");
  if (!mode) {
    throw new Error(`[${suite.name}] missing data-suite-mode marker after authentication`);
  }
  if (suite.demo && mode !== "demo") {
    throw new Error(`[${suite.name}] expected demo suite marker after authentication, got ${mode}`);
  }
  if (!suite.demo && mode !== "real") {
    throw new Error(`[${suite.name}] expected real suite marker after authentication, got ${mode}`);
  }
}

async function expectDisabled(locator, suite, path) {
  const disabled = await locator.evaluate((element) => (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.classList.contains("ant-btn-disabled")
  ));
  if (!disabled) {
    throw new Error(`[${suite.name}] ${path} Visual Copilot button should be disabled without selection or question`);
  }
}

function isBackendRequest(rawURL) {
  try {
    const url = new URL(rawURL);
    return backendOrigins.has(url.origin) || url.pathname === "/api" || url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isIgnorableConsoleMessage(text) {
  return text.includes("ResizeObserver loop completed with undelivered notifications");
}

function isIgnorableRequestFailure(rawURL, failure) {
  if (!failure.includes("ERR_ABORTED")) return false;
  try {
    const url = new URL(rawURL);
    return isBackendRequest(rawURL) ||
      url.pathname.startsWith("/src/") ||
      url.pathname.startsWith("/@vite/") ||
      url.search.includes("t=");
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
