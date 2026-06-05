import { AimOutlined, CameraOutlined, CheckCircleOutlined, CloseOutlined, DeleteOutlined, DragOutlined, InfoCircleOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MessageOutlined, SendOutlined } from "@ant-design/icons";
import { Alert, Button, Collapse, Input, Segmented, Space, Tag, Tooltip, Typography, message } from "antd";
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";
import type { AIChatResponse, BusinessRef, ScreenRegion, VisualCopilotResponse } from "../api/types";
import { useAppSettings, type CopilotDefaultMode } from "../app/AppSettingsContext";
import { useI18n } from "../i18n";
import { ContextPacketPanel, ExecutionDecisionPanel, TrustPacketBar } from "./AiTrust";

type DraftRect = ScreenRegion["rect"] | null;
type PanelRect = { x: number; y: number; width: number; height: number };
type RailPosition = { x: number; y: number };
type CopilotTurn =
  | { id: string; kind: "selection"; question: string; route: string; createdAt: string; regions: ScreenRegion[]; response: VisualCopilotResponse }
  | { id: string; kind: "chat"; question: string; route: string; createdAt: string; response: AIChatResponse };
type ScrollTarget = Window | HTMLElement;
type ScrollSnapshot = { target: ScrollTarget; scrollLeft: number; scrollTop: number };
const visualLayoutStorageKey = "ai-hrms.visual-copilot.layout.v1";
const maxCopilotTurns = 8;

export function VisualCopilotOverlay() {
  const location = useLocation();
  const { settings } = useAppSettings();
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [regions, setRegions] = useState<ScreenRegion[]>([]);
  const [draft, setDraft] = useState<DraftRect>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [mode, setMode] = useState<CopilotDefaultMode>(settings.copilotDefaultMode);
  const [submitting, setSubmitting] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [viewportTick, setViewportTick] = useState(0);
  const [panelRect, setPanelRect] = useState<PanelRect>(() => initialPanelRect());
  const [railPosition, setRailPosition] = useState<RailPosition>(() => initialRailPosition());
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const captureScrollRef = useRef<ScrollSnapshot | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const primaryPanelActionRef = useRef<HTMLButtonElement | null>(null);
  const railCaptureActionRef = useRef<HTMLButtonElement | null>(null);

  function stopAutoScroll() {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function updateDraftFromPointer(pointer: { x: number; y: number }) {
    const currentOrigin = originRef.current;
    if (!currentOrigin) return;
    const point = docPointFromClient(pointer.x, pointer.y, captureScrollRef.current);
    setDraft(toRect(currentOrigin.x, currentOrigin.y, point.x, point.y));
  }

  function runAutoScroll() {
    const pointer = pointerRef.current;
    if (!pointer || !originRef.current) {
      autoScrollFrameRef.current = null;
      return;
    }
    const scroll = autoScrollDelta(pointer);
    if (scroll.x === 0 && scroll.y === 0) {
      autoScrollFrameRef.current = null;
      return;
    }
    scrollByTarget(scroll.target, scroll.x, scroll.y);
    updateDraftFromPointer(pointer);
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
  }

  function scheduleAutoScroll() {
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
    }
  }

  function resetCapture() {
    stopAutoScroll();
    setCaptureMode(false);
    setOrigin(null);
    originRef.current = null;
    pointerRef.current = null;
    captureScrollRef.current = null;
    setDraft(null);
  }

  useEffect(() => {
    if (!active) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isTextEntryTarget(event.target) || hasVisibleBusinessOverlay()) {
          return;
        }
        if (captureMode) {
          resetCapture();
          setPanelCollapsed(false);
          return;
        }
        closeOverlay();
      }
      if (event.key === "Tab" && captureMode) {
        event.preventDefault();
        railCaptureActionRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [active, captureMode]);

  useEffect(() => {
    if (active && !panelCollapsed) {
      window.setTimeout(() => primaryPanelActionRef.current?.focus(), 0);
    }
  }, [active, panelCollapsed]);

  useEffect(() => {
    if (active && captureMode && panelCollapsed) {
      window.setTimeout(() => railCaptureActionRef.current?.focus(), 0);
    }
  }, [active, captureMode, panelCollapsed]);

  useEffect(() => {
    if (!active) return;
    const rerenderSelections = () => {
      setViewportTick((value) => value + 1);
      if (!captureMode) {
        setRegions((current) => syncAnchoredRegionRectsToBusinessRefs(current));
      }
    };
    const clampFloatingControls = () => {
      rerenderSelections();
      setPanelRect((current) => clampPanelRect(current));
      setRailPosition((current) => clampRailPosition(current));
    };
    window.addEventListener("scroll", rerenderSelections, { passive: true, capture: true });
    window.addEventListener("resize", clampFloatingControls);
    window.visualViewport?.addEventListener("resize", clampFloatingControls);
    window.visualViewport?.addEventListener("scroll", clampFloatingControls);
    return () => {
      window.removeEventListener("scroll", rerenderSelections, true);
      window.removeEventListener("resize", clampFloatingControls);
      window.visualViewport?.removeEventListener("resize", clampFloatingControls);
      window.visualViewport?.removeEventListener("scroll", clampFloatingControls);
    };
  }, [active, captureMode]);

  useEffect(() => {
    persistVisualLayout(panelRect, railPosition);
  }, [panelRect, railPosition]);

  useEffect(() => () => stopAutoScroll(), []);

  useEffect(() => {
    if (!active) {
      setMode(settings.copilotDefaultMode);
    }
  }, [active, settings.copilotDefaultMode]);

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || !captureMode || isPanelEvent(event)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const scrollTarget = scrollTargetAt(event.clientX, event.clientY);
    const scrollSnapshot = snapshotScrollTarget(scrollTarget);
    captureScrollRef.current = scrollSnapshot;
    const point = docPointFromClient(event.clientX, event.clientY, scrollSnapshot);
    originRef.current = point;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setOrigin(point);
    setDraft({ x: point.x, y: point.y, width: 0, height: 0, dpr: window.devicePixelRatio || 1 });
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || !captureMode || !originRef.current) {
      return;
    }
    pointerRef.current = { x: event.clientX, y: event.clientY };
    updateDraftFromPointer(pointerRef.current);
    const scroll = autoScrollDelta({ x: event.clientX, y: event.clientY });
    if (scroll.x !== 0 || scroll.y !== 0) {
      scheduleAutoScroll();
    } else {
      stopAutoScroll();
    }
  };

  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentOrigin = originRef.current;
    if (!active || !captureMode || !currentOrigin || !draft) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopAutoScroll();
    const point = docPointFromClient(event.clientX, event.clientY, captureScrollRef.current);
    const rect = toRect(currentOrigin.x, currentOrigin.y, point.x, point.y);
    if (rect.width >= 8 && rect.height >= 8) {
      const matchedRefs = refsInRect(rect);
      const refs = matchedRefs.length ? matchedRefs : refsAt(event.clientX, event.clientY);
      setRegions((current) => [
        ...current,
        { id: nextID(), mode: "rect", rect, businessRefs: refs },
      ]);
      setPanelRect((current) => clampPanelRect(current));
      setPanelCollapsed(false);
      setCaptureMode(false);
    }
    setOrigin(null);
    originRef.current = null;
    pointerRef.current = null;
    captureScrollRef.current = null;
    setDraft(null);
  };

  const closeOverlay = () => {
    resetCapture();
    setActive(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  const currentTurn = turns[0];
  const historyTurns = turns.slice(1);
  const canSubmit = mode === "chat" ? Boolean(instruction.trim()) : Boolean(regions.length);

  const submit = async () => {
    const requested = instruction.trim();
    if (mode === "chat") {
      if (!requested) {
        message.info(t("copilot.needQuestion"));
        return;
      }
      setSubmitting(true);
      try {
        const chat = await api.aiChat(requested);
        const turn: CopilotTurn = {
          id: nextID(),
          kind: "chat",
          question: requested,
          route: location.pathname,
          createdAt: new Date().toISOString(),
          response: chat,
        };
        setTurns((current) => [turn, ...current].slice(0, maxCopilotTurns));
        setInstruction("");
        message.success(t("copilot.chatGenerated"));
      } catch (err) {
        message.error(getErrorMessage(err, "Visual Copilot chat failed"));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!regions.length) {
      message.info(t("copilot.needRegion"));
      return;
    }
    setSubmitting(true);
    try {
      const question = requested || "解释这些选区的业务含义、证据边界、引用依据和可执行动作。";
      const result = await api.visualSuggestions({
        mode: "screenshot_question",
        route: location.pathname,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        screenshot: { mime: "image/png", redacted: true, mode: "layout_snapshot_only" },
        layout: layoutSnapshot(regions),
        dom: domSnapshot(regions),
        regions,
        instruction: question,
      });
      const turn: CopilotTurn = {
        id: nextID(),
        kind: "selection",
        question,
        route: location.pathname,
        createdAt: new Date().toISOString(),
        regions: cloneRegions(regions),
        response: result,
      };
      setTurns((current) => [turn, ...current].slice(0, maxCopilotTurns));
      setInstruction("");
      message.success(t("copilot.selectionGenerated"));
    } catch (err) {
      message.error(getErrorMessage(err, "Visual Copilot 提交失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const fab = (
    <Tooltip title="Visual Copilot">
      <Button
        className={active ? "visual-copilot-fab is-active" : "visual-copilot-fab"}
        shape="circle"
        type={active ? "primary" : "default"}
        icon={<AimOutlined />}
        aria-label="打开 Visual Copilot"
        title="打开 Visual Copilot"
        onClick={(event) => {
          openerRef.current = event.currentTarget;
          if (active) {
            closeOverlay();
          } else {
            setActive(true);
            setPanelCollapsed(false);
          }
        }}
        data-vc-action="visual_copilot.toggle"
      />
    </Tooltip>
  );

  return (
    <>
      {typeof document === "undefined" ? fab : createPortal(fab, document.body)}
      {active ? createPortal(
        <div
          className={captureMode ? "visual-copilot-layer is-capturing" : "visual-copilot-layer"}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={() => {
            resetCapture();
          }}
        >
          {regions.map((region) => <RegionBox key={region.id} region={region} viewportTick={viewportTick} />)}
          {draft ? <div className="visual-region draft" style={rectStyle(draft, viewportTick)} /> : null}
          {panelCollapsed ? (
            <div
              aria-label="Visual Copilot 侧栏"
              className={captureMode ? "visual-copilot-rail is-capturing" : "visual-copilot-rail"}
              data-vc-kind="visual-copilot-rail"
              style={railStyle(railPosition)}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Tooltip title="拖动侧栏">
                <button
                  className="visual-rail-drag-handle"
                  type="button"
                  aria-label="拖动 Visual Copilot 侧栏"
                  title="拖动侧栏"
                  onKeyDown={(event) => moveRailByKeyboard(event, setRailPosition)}
                  onPointerDown={(event) => beginRailDrag(event, railPosition, setRailPosition)}
                >
                  <DragOutlined />
                </button>
              </Tooltip>
              <Tooltip title="展开面板">
                <Button
                  shape="circle"
                  type="default"
                  aria-label="展开 Visual Copilot"
                  title="展开面板"
                  icon={<MenuUnfoldOutlined />}
                  onClick={() => {
                    setPanelRect((current) => panelFromRail(current, railPosition));
                    setPanelCollapsed(false);
                    resetCapture();
                  }}
                />
              </Tooltip>
              <Tooltip title={captureMode ? "退出圈选，恢复页面操作" : "开始圈选页面区域"}>
                <Button
                  ref={railCaptureActionRef}
                  shape="circle"
                  type={captureMode ? "primary" : "default"}
                  aria-label="开始圈选"
                  aria-pressed={captureMode}
                  title={captureMode ? "退出圈选" : "开始圈选"}
                  icon={<AimOutlined />}
                  onClick={() => {
                    if (captureMode) {
                      resetCapture();
                    } else {
                      setCaptureMode(true);
                      setPanelCollapsed(true);
                      setOrigin(null);
                      setDraft(null);
                    }
                  }}
                />
              </Tooltip>
              <Tooltip title="清空选区">
                <Button shape="circle" aria-label="清空选区" title="清空选区" icon={<DeleteOutlined />} onClick={() => { setRegions([]); }} />
              </Tooltip>
              <Tooltip title="关闭">
                  <Button shape="circle" aria-label="关闭 Visual Copilot" title="关闭" icon={<CloseOutlined />} onClick={closeOverlay} />
              </Tooltip>
            </div>
          ) : null}
          {!panelCollapsed ? <div
            aria-labelledby="visual-copilot-title"
            aria-modal="false"
            className="visual-copilot-panel"
            data-vc-kind="visual-copilot-panel"
            role="dialog"
            style={panelStyle(panelRect)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="visual-copilot-panel-header">
              <div className="visual-panel-title-row">
                <button
                  aria-label="拖动 Visual Copilot 面板"
                  className="visual-panel-drag-handle"
                  type="button"
                  title="拖动面板"
                  onKeyDown={(event) => movePanelByKeyboard(event, setPanelRect)}
                  onPointerDown={(event) => beginPanelDrag(event, panelRect, setPanelRect)}
                >
                  <DragOutlined />
                </button>
                <div>
                  <Typography.Text id="visual-copilot-title" strong>Visual Copilot</Typography.Text>
                  <Typography.Text type="secondary">
                    {t("copilot.subtitle")}
                  </Typography.Text>
                </div>
              </div>
              <Space>
                <Button
                  ref={primaryPanelActionRef}
                  type={captureMode ? "primary" : "default"}
                  title="收起为窄侧栏后圈选页面区域"
                  onClick={() => {
                    setMode("screenshot");
                    setCaptureMode(true);
                    setPanelCollapsed(true);
                    setRailPosition(railFromPanel(panelRect));
                    setOrigin(null);
                    setDraft(null);
                  }}
                >
                  开始圈选
                </Button>
                <Button aria-label="收缩到侧边栏" title="收缩到可拖动窄侧栏，不拦截页面输入" icon={<MenuFoldOutlined />} onClick={() => { resetCapture(); setRailPosition(railFromPanel(panelRect)); setPanelCollapsed(true); }} />
                <Button aria-label="关闭 Visual Copilot" title="关闭" icon={<CloseOutlined />} onClick={closeOverlay} />
              </Space>
            </div>
            <div className="visual-copilot-toolbar">
              <Segmented
                className="visual-mode-switch"
                value={mode}
                onChange={(value) => setMode(value === "screenshot" ? "screenshot" : "chat")}
                options={[
                  { label: <span><MessageOutlined /> {t("copilot.chat")}</span>, value: "chat" },
                  { label: <span><CameraOutlined /> {t("copilot.screenshot")}</span>, value: "screenshot" },
                ]}
              />
              <Input.TextArea
                rows={2}
                placeholder={mode === "chat" ? t("copilot.chatPlaceholder") : t("copilot.screenshotPlaceholder")}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                data-vc-field="visual_copilot.instruction"
              />
              <Button icon={<SendOutlined />} type="primary" loading={submitting} onClick={submit} disabled={!canSubmit}>
                {mode === "chat" ? t("copilot.ask") : t("copilot.submit")}
              </Button>
              <Button aria-label="清空选区" title="清空选区" icon={<DeleteOutlined />} onClick={() => { setRegions([]); setCaptureMode(false); }} />
            </div>
            <div className="visual-copilot-body">
              {currentTurn ? <CopilotTurnCard turn={currentTurn} current /> : null}
              {historyTurns.length ? (
                <Collapse
                  className="visual-history-collapse"
                  size="small"
                  items={[{
                    key: "history",
                    label: `历史记录 ${historyTurns.length}`,
                    children: (
                      <div className="visual-history-list">
                        {historyTurns.map((turn) => <CopilotTurnCard key={turn.id} turn={turn} />)}
                      </div>
                    ),
                  }]}
                />
              ) : null}
              {regions.length ? (
                <div className="visual-selection-list">
                  <Tag color="blue">{selectedObjectsSummary(regions)}</Tag>
                  {regions.map((region, index) => (
                    <Tag
                      key={region.id}
                      closable
                      onClose={(event) => {
                        event.preventDefault();
                        setRegions((current) => current.filter((item) => item.id !== region.id));
                      }}
                      onClick={() => window.scrollTo({ top: Math.max(region.rect.y - 120, 0), behavior: "smooth" })}
                    >
                      选区 {index + 1} · {regionLabel(region)}
                    </Tag>
                  ))}
                </div>
              ) : mode === "screenshot" ? (
                <Alert className="visual-copilot-hint" type="info" showIcon title="先点击“开始圈选”，面板会收缩成窄侧栏，然后拖拽选择卡片、行、字段或按钮；侧栏准星可随时退出圈选并恢复页面输入。当前只使用 DOM 与业务对象上下文，不启用图像识别。" />
              ) : (
                <Alert className="visual-copilot-hint" type="info" showIcon title="普通问答不会采集坐标或截图；需要解释页面区域时切换到“截图/圈选问”。涉及引用位置和制度依据的问题会走 RAG 检索并展示 citations。" />
              )}
            </div>
            <button
              aria-label="调整 Visual Copilot 面板大小"
              className="visual-panel-resize-handle"
              title="调整面板大小"
              type="button"
              onKeyDown={(event) => resizePanelByKeyboard(event, setPanelRect)}
              onPointerDown={(event) => beginPanelResize(event, panelRect, setPanelRect)}
            />
          </div> : null}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function CopilotTurnCard({ turn, current = false }: { turn: CopilotTurn; current?: boolean }) {
  return turn.kind === "selection"
    ? <SelectionTurnCard turn={turn} current={current} />
    : <ChatTurnCard turn={turn} current={current} />;
}

function SelectionTurnCard({ turn, current }: { turn: Extract<CopilotTurn, { kind: "selection" }>; current: boolean }) {
  const response = turn.response;
  const decision = response.executionDecision ?? response.result.executionDecision;
  const packet = response.contextPacket ?? response.result.contextPacket;
  const trust = response.trustPacket ?? response.result.trustPacket;
  return (
    <div className={current ? "visual-response is-current" : "visual-response"} data-vc-kind={current ? "visual-copilot-response" : undefined}>
      <div className="visual-turn-meta">
        <Tag color="processing">选区解释</Tag>
        <Typography.Text type="secondary">{formatTurnTime(turn.createdAt)}</Typography.Text>
        <Typography.Text className="visual-chat-question">{turn.question}</Typography.Text>
      </div>
      <div className="visual-response-header">
        <CheckCircleOutlined />
        <div>
          <Typography.Text strong>{response.result.title || "解释已生成"}</Typography.Text>
          <Typography.Text type="secondary">
            {response.result.preview}
          </Typography.Text>
        </div>
      </div>
      <Typography.Paragraph className="visual-response-explanation">
        {response.result.explanation || response.result.preview}
      </Typography.Paragraph>
      {response.result.selectedSummary ? (
        <Typography.Paragraph className="visual-response-summary">
          {response.result.selectedSummary}
        </Typography.Paragraph>
      ) : null}
      <Space wrap>
        <TrustPacketBar packet={trust} />
        <Tag color={riskColor(response.result.riskLevel)}>risk={response.result.riskLevel || "low"}</Tag>
        <Tag color="geekblue">confidence={Math.round((response.result.confidence ?? response.event.confidence) * 100)}%</Tag>
        {response.result.provider ? <Tag color="purple">LLM={response.result.provider}/{response.result.model || "unknown"}</Tag> : null}
        <Tag icon={<InfoCircleOutlined />} color="default">{response.result.imageMode || "no-image-analysis"}</Tag>
        {response.result.actions.map((action, index) => (
          <Tag
            key={`${String(action.type ?? "action")}-${index}`}
            color={action.blocked ? "red" : riskColor(String(action.riskLevel ?? action.risk ?? "low"))}
          >
            {String(action.label ?? action.type)} · risk={String(action.riskLevel ?? action.risk ?? "low")}{action.blocked ? " · blocked" : ""}
          </Tag>
        ))}
      </Space>
      <Alert
        className="visual-response-boundary"
        data-vc-kind={current ? "visual-copilot-boundary" : undefined}
        type="info"
        showIcon
        title={response.result.trustBoundary || "当前解释基于页面上下文和业务对象引用，不代表已完成图片视觉识别。"}
      />
      <ExecutionDecisionPanel decision={decision} />
      <ContextPacketPanel packet={packet} />
    </div>
  );
}

function ChatTurnCard({ turn, current }: { turn: Extract<CopilotTurn, { kind: "chat" }>; current: boolean }) {
  const response = turn.response;
  const decision = response.executionDecision;
  const packet = response.contextPacket;
  const trust = response.trustPacket;
  return (
    <article className={current ? "visual-page-chat is-current" : "visual-page-chat"} data-vc-kind={current ? "visual-page-chat" : undefined}>
      <div className="visual-turn-meta">
        <Tag color="cyan">普通问答</Tag>
        <Typography.Text type="secondary">{formatTurnTime(turn.createdAt)}</Typography.Text>
        <Typography.Text className="visual-chat-question">{turn.question}</Typography.Text>
      </div>
      <div className="visual-response-header">
        <CheckCircleOutlined />
        <div>
          <Typography.Text strong>RAG / AI Chat 回答已生成</Typography.Text>
          <Typography.Text type="secondary">{response.provider || "program"}/{response.model || "routing"}</Typography.Text>
        </div>
      </div>
      <Typography.Paragraph>{response.message}</Typography.Paragraph>
      <Space wrap>
        <TrustPacketBar packet={trust} />
        <Tag color={riskColor(response.riskLevel)}>risk={response.riskLevel ?? "low"}</Tag>
        <Tag>confidence={Math.round((response.confidence ?? 0.72) * 100)}%</Tag>
        <Tag color={response.provider === "deepseek" ? "purple" : "default"}>{response.provider || "program"}/{response.model || "routing"}</Tag>
        {(trust?.humanReviewRequired || decision?.humanReviewRequired) ? <Tag color="red">humanReviewRequired=true</Tag> : null}
      </Space>
      <Collapse
        className="visual-history-collapse"
        size="small"
        defaultActiveKey={[]}
        items={[{
          key: "citations",
          label: `引用 ${response.citations?.length ?? 0}`,
          children: (
            <div className="visual-citation-list">
              {(response.citations ?? []).map((citation) => (
                <Tag key={`${citation.documentId}:${citation.chunkId}`} color="blue">{citation.title}</Tag>
              ))}
            </div>
          ),
        }]}
      />
      {packet?.boundary ? (
        <Alert
          className="visual-response-boundary"
          type="info"
          showIcon
          title={packet.boundary}
        />
      ) : null}
      <ExecutionDecisionPanel decision={decision} />
      <ContextPacketPanel packet={packet} />
    </article>
  );
}

function RegionBox({ region, viewportTick }: { region: ScreenRegion; viewportTick: number }) {
  return (
    <div className="visual-region" style={rectStyle(region.rect, viewportTick)}>
      <span>{regionLabel(region)}</span>
    </div>
  );
}

function toRect(x1: number, y1: number, x2: number, y2: number): ScreenRegion["rect"] {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    dpr: window.devicePixelRatio || 1,
  };
}

function rectStyle(rect: ScreenRegion["rect"], viewportTick = 0) {
  void viewportTick;
  return {
    left: rect.x - window.scrollX,
    top: rect.y - window.scrollY,
    width: Math.max(rect.width, 8),
    height: Math.max(rect.height, 8),
  };
}

function defaultPanelRect(): PanelRect {
  if (typeof window === "undefined") {
    return { x: 20, y: 20, width: 560, height: 680 };
  }
  const width = Math.min(560, Math.max(360, window.innerWidth - 40));
  const height = Math.min(680, Math.max(360, window.innerHeight - 40));
  return clampPanelRect({
    x: window.innerWidth - width - 20,
    y: 20,
    width,
    height,
  });
}

function initialPanelRect(): PanelRect {
  const stored = readVisualLayout();
  return stored?.panelRect ? clampPanelRect(stored.panelRect) : defaultPanelRect();
}

function initialRailPosition(): RailPosition {
  const stored = readVisualLayout();
  if (stored?.railPosition) return clampRailPosition(stored.railPosition);
  if (typeof window === "undefined") return { x: 12, y: 240 };
  return clampRailPosition({ x: window.innerWidth - 58, y: Math.round(window.innerHeight / 2) });
}

function readVisualLayout(): { panelRect?: PanelRect; railPosition?: RailPosition } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(visualLayoutStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as { panelRect?: PanelRect; railPosition?: RailPosition; railY?: number };
    if (value.panelRect && !isPanelRect(value.panelRect)) {
      delete value.panelRect;
    }
    if (value.railPosition && !isRailPosition(value.railPosition)) {
      delete value.railPosition;
    }
    if (!value.railPosition && typeof value.railY === "number" && Number.isFinite(value.railY) && typeof window !== "undefined") {
      value.railPosition = { x: window.innerWidth - 58, y: value.railY };
    }
    return value;
  } catch {
    return null;
  }
}

function persistVisualLayout(panelRect: PanelRect, railPosition: RailPosition) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(visualLayoutStorageKey, JSON.stringify({ panelRect, railPosition }));
  } catch {
    // Persisting layout is a convenience; private browsing quota errors should not break the overlay.
  }
}

function isPanelRect(value: PanelRect) {
  return ["x", "y", "width", "height"].every((key) => {
    const numberValue = value[key as keyof PanelRect];
    return typeof numberValue === "number" && Number.isFinite(numberValue);
  });
}

function isRailPosition(value: RailPosition) {
  return typeof value.x === "number" && Number.isFinite(value.x)
    && typeof value.y === "number" && Number.isFinite(value.y);
}

function panelStyle(rect: PanelRect) {
  const clamped = clampPanelRect(rect);
  return {
    left: clamped.x,
    top: clamped.y,
    width: clamped.width,
    height: clamped.height,
  };
}

function railStyle(position: RailPosition) {
  const clamped = clampRailPosition(position);
  return { left: clamped.x, top: clamped.y };
}

function railFromPanel(rect: PanelRect) {
  const bounds = visualBounds();
  const railWidth = 56;
  const x = rect.x + rect.width / 2 < bounds.x + bounds.width / 2
    ? bounds.x + 8
    : bounds.x + bounds.width - railWidth - 8;
  return clampRailPosition({ x, y: rect.y + rect.height / 2 });
}

function panelFromRail(rect: PanelRect, railPosition: RailPosition) {
  const bounds = visualBounds();
  const nextX = railPosition.x < bounds.x + bounds.width / 2
    ? railPosition.x + 66
    : railPosition.x - rect.width - 12;
  return clampPanelRect({ ...rect, x: nextX, y: railPosition.y - rect.height / 2 });
}

function beginPanelDrag(
  event: ReactPointerEvent<HTMLElement>,
  panelRect: PanelRect,
  setPanelRect: Dispatch<SetStateAction<PanelRect>>,
) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const startRect = panelRect;
  const pointerID = event.pointerId;
  const move = (pointer: PointerEvent) => {
    if (pointer.pointerId !== pointerID) return;
    setPanelRect(clampPanelRect({
      ...startRect,
      x: startRect.x + pointer.clientX - startX,
      y: startRect.y + pointer.clientY - startY,
    }));
  };
  const done = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", done);
    window.removeEventListener("pointercancel", done);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", done, { once: true });
  window.addEventListener("pointercancel", done, { once: true });
}

function beginPanelResize(
  event: ReactPointerEvent<HTMLElement>,
  panelRect: PanelRect,
  setPanelRect: Dispatch<SetStateAction<PanelRect>>,
) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const startRect = panelRect;
  const pointerID = event.pointerId;
  const move = (pointer: PointerEvent) => {
    if (pointer.pointerId !== pointerID) return;
    setPanelRect(clampPanelRect({
      ...startRect,
      width: startRect.width + pointer.clientX - startX,
      height: startRect.height + pointer.clientY - startY,
    }));
  };
  const done = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", done);
    window.removeEventListener("pointercancel", done);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", done, { once: true });
  window.addEventListener("pointercancel", done, { once: true });
}

function movePanelByKeyboard(
  event: ReactKeyboardEvent<HTMLElement>,
  setPanelRect: Dispatch<SetStateAction<PanelRect>>,
) {
  const delta = keyboardDelta(event);
  if (!delta) return;
  event.preventDefault();
  event.stopPropagation();
  setPanelRect((current) => clampPanelRect({ ...current, x: current.x + delta.x, y: current.y + delta.y }));
}

function resizePanelByKeyboard(
  event: ReactKeyboardEvent<HTMLElement>,
  setPanelRect: Dispatch<SetStateAction<PanelRect>>,
) {
  const delta = keyboardDelta(event);
  if (!delta) return;
  event.preventDefault();
  event.stopPropagation();
  setPanelRect((current) => clampPanelRect({ ...current, width: current.width + delta.x, height: current.height + delta.y }));
}

function moveRailByKeyboard(
  event: ReactKeyboardEvent<HTMLElement>,
  setRailPosition: Dispatch<SetStateAction<RailPosition>>,
) {
  const delta = keyboardDelta(event);
  if (!delta) return;
  event.preventDefault();
  event.stopPropagation();
  setRailPosition((current) => clampRailPosition({ x: current.x + delta.x, y: current.y + delta.y }));
}

function keyboardDelta(event: ReactKeyboardEvent<HTMLElement>) {
  const step = event.shiftKey ? 40 : 12;
  switch (event.key) {
    case "ArrowLeft":
      return { x: -step, y: 0 };
    case "ArrowRight":
      return { x: step, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -step };
    case "ArrowDown":
      return { x: 0, y: step };
    default:
      return null;
  }
}

function beginRailDrag(
  event: ReactPointerEvent<HTMLElement>,
  railPosition: RailPosition,
  setRailPosition: Dispatch<SetStateAction<RailPosition>>,
) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  const startX = event.clientX;
  const startY = event.clientY;
  const startRailPosition = railPosition;
  const pointerID = event.pointerId;
  const move = (pointer: PointerEvent) => {
    if (pointer.pointerId !== pointerID) return;
    setRailPosition(clampRailPosition({
      x: startRailPosition.x + pointer.clientX - startX,
      y: startRailPosition.y + pointer.clientY - startY,
    }));
  };
  const done = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", done);
    window.removeEventListener("pointercancel", done);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", done, { once: true });
  window.addEventListener("pointercancel", done, { once: true });
}

function clampPanelRect(rect: PanelRect): PanelRect {
  if (typeof window === "undefined") return rect;
  const margin = 12;
  const bounds = visualBounds();
  const minWidth = Math.min(340, bounds.width - margin * 2);
  const minHeight = Math.min(300, bounds.height - margin * 2);
  const maxWidth = Math.max(minWidth, bounds.width - margin * 2);
  const maxHeight = Math.max(minHeight, bounds.height - margin * 2);
  const width = clamp(rect.width, minWidth, maxWidth);
  const height = clamp(rect.height, minHeight, maxHeight);
  return {
    x: clamp(rect.x, bounds.x + margin, bounds.x + bounds.width - width - margin),
    y: clamp(rect.y, bounds.y + margin, bounds.y + bounds.height - height - margin),
    width,
    height,
  };
}

function clampRailPosition(position: RailPosition) {
  if (typeof window === "undefined") return position;
  const bounds = visualBounds();
  const railWidth = 56;
  const railHeight = 268;
  return {
    x: clamp(position.x, bounds.x + 8, bounds.x + bounds.width - railWidth - 8),
    y: clamp(position.y, bounds.y + 54, bounds.y + bounds.height - Math.min(railHeight, bounds.height - 16)),
  };
}

function visualBounds() {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: 1024, height: 768 };
  }
  const viewport = window.visualViewport;
  return {
    x: viewport?.offsetLeft ?? 0,
    y: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function refsAt(x: number, y: number): BusinessRef[] {
  const elements = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const element of elements) {
    if (element.closest(".visual-copilot-layer")) {
      continue;
    }
    const target = element.closest("[data-vc-object-type][data-vc-object-id]") as HTMLElement | null;
    if (!target) {
      continue;
    }
    return [{
      type: target.dataset.vcObjectType as BusinessRef["type"],
      id: target.dataset.vcObjectId || "",
      label: target.dataset.vcLabel || target.getAttribute("aria-label") || undefined,
    }];
  }
  return [];
}

function refsInRect(rect: ScreenRegion["rect"]): BusinessRef[] {
  const refs = new Map<string, { ref: BusinessRef; area: number; ratio: number; top: number; left: number }>();
  document.querySelectorAll<HTMLElement>("[data-vc-object-type][data-vc-object-id]").forEach((element) => {
    if (element.offsetParent === null) {
      return;
    }
    const box = docRect(element);
    const area = intersectionArea(rect, box);
    if (area < 16) {
      return;
    }
    const elementArea = Math.max(box.width * box.height, 1);
    const ratio = area / elementArea;
    const rowLike = element.dataset.vcKind === "table-row" || element.tagName.toLowerCase() === "tr";
    if (rowLike && ratio < 0.22 && !pointInRect({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, rect)) {
      return;
    }
    if (!rowLike && ratio < 0.04 && area < 240) {
      return;
    }
    const ref: BusinessRef = {
      type: element.dataset.vcObjectType as BusinessRef["type"],
      id: element.dataset.vcObjectId || "",
      label: element.dataset.vcLabel || element.getAttribute("aria-label") || undefined,
    };
    const key = `${ref.type}:${ref.id}`;
    const existing = refs.get(key);
    if (!existing || area > existing.area) {
      refs.set(key, { ref, area, ratio, top: box.y, left: box.x });
    }
  });
  return Array.from(refs.values())
    .sort((left, right) => left.top - right.top || left.left - right.left || right.ratio - left.ratio)
    .slice(0, 16)
    .map((item) => item.ref);
}

function pointInRect(point: { x: number; y: number }, rect: ScreenRegion["rect"]) {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function syncAnchoredRegionRectsToBusinessRefs(regions: ScreenRegion[]) {
  let changed = false;
  const next = regions.map((region) => {
    if (region.mode !== "element") {
      return region;
    }
    const ref = region.businessRefs[0];
    if (!ref) return region;
    const element = elementForBusinessRef(ref);
    if (!element || element.offsetParent === null) return region;
    const box = docRect(element);
    if (box.width < 4 || box.height < 4) return region;
    const rect = { ...box, dpr: window.devicePixelRatio || 1 };
    const same = Math.abs(region.rect.x - rect.x) < 1
      && Math.abs(region.rect.y - rect.y) < 1
      && Math.abs(region.rect.width - rect.width) < 1
      && Math.abs(region.rect.height - rect.height) < 1;
    if (same) return region;
    changed = true;
    return { ...region, rect };
  });
  return changed ? next : regions;
}

function elementForBusinessRef(ref: BusinessRef) {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-vc-object-type][data-vc-object-id]"))) {
    if (element.dataset.vcObjectType === ref.type && element.dataset.vcObjectId === ref.id) {
      return element;
    }
  }
  return null;
}

function intersectionArea(rect: ScreenRegion["rect"], box: { x: number; y: number; width: number; height: number }) {
  const boxRight = box.x + box.width;
  const boxBottom = box.y + box.height;
  const width = Math.max(0, Math.min(rect.x + rect.width, boxRight) - Math.max(rect.x, box.x));
  const height = Math.max(0, Math.min(rect.y + rect.height, boxBottom) - Math.max(rect.y, box.y));
  return width * height;
}

function domSnapshot(regions: ScreenRegion[]) {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-vc-kind], [data-vc-action], [data-vc-field], [data-vc-object-type]"))
    .filter((element) => !element.closest(".visual-copilot-panel, .visual-copilot-rail, .visual-copilot-layer"))
    .filter((element) => !element.matches(".app-shell") && !element.closest(".app-sider, .ant-layout-sider, .ant-menu"))
    .map((element) => {
      const box = docRect(element);
      const selectedArea = regions.reduce((sum, region) => sum + intersectionArea(region.rect, box), 0);
      const specificity = visualSpecificity(element);
      return {
        box,
        selectedArea,
        specificity,
        kind: element.dataset.vcKind,
        action: element.dataset.vcAction,
        field: element.dataset.vcField,
        objectType: element.dataset.vcObjectType,
        objectId: element.dataset.vcObjectId,
        label: compactLabel(element),
        text: compactText(element),
        tag: element.tagName.toLowerCase(),
        visible: element.offsetParent !== null,
        rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    })
    .filter((node) => {
      if (!node.visible || node.selectedArea <= 0) {
        return false;
      }
      const nodeArea = Math.max(node.box.width * node.box.height, 1);
      const selectedRegionArea = Math.max(
        regions.reduce((sum, region) => sum + region.rect.width * region.rect.height, 0),
        1,
      );
      const isHugeContainer = nodeArea > selectedRegionArea * 3 && node.specificity < 2;
      const looksLikeShell = /app-shell|app-sider|ant-layout-sider|ant-menu|visual-copilot/i.test(node.label || "");
      return !isHugeContainer && !looksLikeShell;
    })
    .sort((left, right) => (right.specificity * 1000 + right.selectedArea) - (left.specificity * 1000 + left.selectedArea))
    .slice(0, 12)
    .map(({ box: _box, selectedArea: _selectedArea, specificity: _specificity, ...node }) => node);
}

function layoutSnapshot(regions: ScreenRegion[]) {
  const container = {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    dpr: window.devicePixelRatio || 1,
    capture: "relative_to_selected_regions",
  };
  const items: Array<Record<string, unknown>> = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (parent.closest(".visual-copilot-panel, .visual-copilot-rail, .visual-copilot-layer, .app-sider, .ant-layout-sider, .ant-menu")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.offsetParent === null) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  while (walker.nextNode() && items.length < 80) {
    const textNode = walker.currentNode;
    const parent = textNode.parentElement;
    if (!parent) continue;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const style = getComputedStyle(parent);
    for (const rect of Array.from(range.getClientRects())) {
      const docBox = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
      const region = regions.find((item) => intersectionArea(item.rect, docBox) > 4);
      if (!region || region.rect.width <= 0 || region.rect.height <= 0) continue;
      const text = redactLayoutText(textNode.textContent || "");
      if (!text) continue;
      items.push({
        text,
        regionId: region.id,
        x: docBox.x - region.rect.x,
        y: docBox.y - region.rect.y,
        width: docBox.width,
        height: docBox.height,
        xRatio: (docBox.x - region.rect.x) / region.rect.width,
        yRatio: (docBox.y - region.rect.y) / region.rect.height,
        wRatio: docBox.width / region.rect.width,
        hRatio: docBox.height / region.rect.height,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
        lineHeight: style.lineHeight,
      });
      if (items.length >= 80) break;
    }
    range.detach();
  }
  return {
    container,
    regions: regions.map((region) => ({
      id: region.id,
      x: region.rect.x,
      y: region.rect.y,
      width: region.rect.width,
      height: region.rect.height,
      xRatio: region.rect.x / Math.max(document.documentElement.scrollWidth, 1),
      yRatio: region.rect.y / Math.max(document.documentElement.scrollHeight, 1),
      wRatio: region.rect.width / Math.max(document.documentElement.scrollWidth, 1),
      hRatio: region.rect.height / Math.max(document.documentElement.scrollHeight, 1),
      businessRefCount: region.businessRefs.length,
    })),
    items,
  };
}

function pageChatRegion(): ScreenRegion {
  return {
    id: nextID(),
    mode: "rect",
    rect: {
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    },
    businessRefs: [],
  };
}

function pageChatDomSnapshot(route: string, region: ScreenRegion) {
  return [{
    kind: "page_context",
    label: routePageLabel(route),
    text: pageContextSummary(route),
    tag: "page",
    visible: true,
    rect: {
      x: region.rect.x,
      y: region.rect.y,
      width: region.rect.width,
      height: region.rect.height,
    },
  }];
}

function pageContextSummary(route: string) {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-vc-page], [data-vc-kind], [data-vc-object-type], [data-vc-action]"))
    .filter((element) => !element.closest(".visual-copilot-panel, .visual-copilot-rail, .visual-copilot-layer"))
    .filter((element) => !element.closest(".app-sider, .ant-layout-sider, .ant-menu"))
    .filter((element) => element.offsetParent !== null);
  const pageMarkers = dedupe(elements.map((element) => element.dataset.vcPage || "").filter(Boolean));
  const objectCounts: Record<string, number> = {};
  const modules: string[] = [];
  const actions: string[] = [];
  const overlays: string[] = [];
  for (const element of elements) {
    const objectType = element.dataset.vcObjectType;
    if (objectType) {
      objectCounts[objectType] = (objectCounts[objectType] || 0) + 1;
    }
    const kind = element.dataset.vcKind;
    if (kind && !objectType) {
      modules.push(kind);
      if (/drawer|editor|modal|form/i.test(kind)) {
        overlays.push(compactVisualText(kind, 50));
      }
    }
    if (element.dataset.vcAction) {
      actions.push(element.dataset.vcAction);
    }
  }
  const objectLine = Object.keys(objectCounts).length
    ? Object.entries(objectCounts).map(([type, count]) => `${type}=${count}`).join(", ")
    : "无具名业务对象";
  return [
    `当前页面：${route}`,
    `页面类型：${pageMarkers[0] || routePageLabel(route)}`,
    `可见业务对象统计：${objectLine}`,
    "可见对象示例：未随页面问答发送；需要解释具体员工、资料、事件或组织时，请先圈选对象，让后端按 scope 解析。",
    modules.length ? `页面模块：${dedupe(modules).slice(0, 8).join("、")}` : "页面模块：未标记",
    actions.length ? `可用操作：${dedupe(actions).slice(0, 8).join("、")}` : "可用操作：未标记",
    overlays.length ? `当前打开浮层：${dedupe(overlays).slice(0, 3).join("、")}` : "当前打开浮层：无",
  ].join("\n");
}

function routePageLabel(route: string) {
  if (route.includes("employees")) return "员工数据层";
  if (route.includes("legal-entities")) return "法人 scope 底座";
  if (route.includes("org-units")) return "组织 scope 图谱";
  if (route.includes("users")) return "账号与角色";
  if (route.includes("attendance")) return "考勤信号";
  if (route.includes("messages")) return "消息证据";
  if (route.includes("knowledge")) return "知识治理";
  if (route.includes("docs")) return "文档库";
  if (route.includes("audit")) return "信任与审计";
  if (route.includes("settings")) return "设置";
  if (route.includes("agents")) return "Agent 运行控制";
  if (route.includes("learning")) return "Learning Layer";
  if (route.includes("co-growth")) return "Co-Growth Engine";
  if (route.includes("ai-command")) return "AI 指挥中心";
  if (route.includes("dashboard")) return "指挥看板";
  return "AI-HRMS 页面";
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function compactVisualText(value: string, limit: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function redactLayoutText(value: string) {
  return value
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b1[3-9]\d{9}\b/g, "[mobile]")
    .replace(/\b\d{12,19}\b/g, "[number]")
    .replace(/\b\d{15}(\d{2}[0-9Xx])?\b/g, "[id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function compactText(element: HTMLElement) {
  const formText = formControlText(element);
  const text = (formText || element.innerText || element.textContent || "")
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b1[3-9]\d{9}\b/g, "[mobile]")
    .replace(/\b\d{12,19}\b/g, "[number]")
    .replace(/\b\d{15}(\d{2}[0-9Xx])?\b/g, "[id]")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function compactLabel(element: HTMLElement) {
  const label = element.dataset.vcLabel
    || element.getAttribute("aria-label")
    || element.dataset.vcAction
    || element.dataset.vcField
    || formControlText(element)
    || compactText(element)
    || element.dataset.vcKind
    || element.tagName.toLowerCase();
  return label.length > 80 ? `${label.slice(0, 80)}...` : label;
}

function formControlText(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value || element.placeholder || "";
  }
  if (element instanceof HTMLSelectElement) {
    return element.selectedOptions[0]?.textContent?.trim() || element.value || "";
  }
  const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
  if (!input) return "";
  if (input instanceof HTMLSelectElement) {
    return input.selectedOptions[0]?.textContent?.trim() || input.value || "";
  }
  return input.value || input.placeholder || "";
}

function visualSpecificity(element: HTMLElement) {
  let score = 0;
  if (element.dataset.vcObjectType && element.dataset.vcObjectId) score += 5;
  if (element.dataset.vcField) score += 3;
  if (element.dataset.vcAction) score += 3;
  if (element.dataset.vcKind) score += 1;
  if (element.matches("input, textarea, select, button")) score += 2;
  return score;
}

function docRect(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return {
    x: box.x + window.scrollX,
    y: box.y + window.scrollY,
    width: box.width,
    height: box.height,
  };
}

function docPointFromClient(clientX: number, clientY: number, snapshot: ScrollSnapshot | null) {
  void snapshot;
  return { x: clientX + window.scrollX, y: clientY + window.scrollY };
}

function autoScrollDelta(pointer: { x: number; y: number }) {
  const edge = 56;
  const step = 24;
  const target = scrollTargetAt(pointer.x, pointer.y);
  const rect = target instanceof Window
    ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
    : target.getBoundingClientRect();
  const x = pointer.x - rect.left < edge ? -step : rect.right - pointer.x < edge ? step : 0;
  const y = pointer.y - rect.top < edge ? -step : rect.bottom - pointer.y < edge ? step : 0;
  return {
    target,
    x: canScrollTarget(target, "x", x) ? x : 0,
    y: canScrollTarget(target, "y", y) ? y : 0,
  };
}

function scrollTargetAt(x: number, y: number): ScrollTarget {
  const elements = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const element of elements) {
    if (element.closest(".visual-copilot-layer, .visual-copilot-panel, .visual-copilot-rail")) {
      continue;
    }
    const scrollable = closestScrollable(element);
    if (scrollable) {
      return scrollable;
    }
  }
  return window;
}

function snapshotScrollTarget(target: ScrollTarget): ScrollSnapshot {
  if (target instanceof Window) {
    return { target, scrollLeft: window.scrollX, scrollTop: window.scrollY };
  }
  return { target, scrollLeft: target.scrollLeft, scrollTop: target.scrollTop };
}

function closestScrollable(element: HTMLElement | null) {
  let current: HTMLElement | null = element;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 2;
    const canScrollX = /(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 2;
    if (canScrollY || canScrollX) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function canScrollTarget(target: ScrollTarget, axis: "x" | "y", delta: number) {
  if (delta === 0) return false;
  if (target instanceof Window) {
    const position = axis === "x" ? window.scrollX : window.scrollY;
    const viewport = axis === "x" ? window.innerWidth : window.innerHeight;
    const total = axis === "x" ? document.documentElement.scrollWidth : document.documentElement.scrollHeight;
    return delta < 0 ? position > 0 : position + viewport < total - 1;
  }
  const position = axis === "x" ? target.scrollLeft : target.scrollTop;
  const viewport = axis === "x" ? target.clientWidth : target.clientHeight;
  const total = axis === "x" ? target.scrollWidth : target.scrollHeight;
  return delta < 0 ? position > 0 : position + viewport < total - 1;
}

function scrollByTarget(target: ScrollTarget, left: number, top: number) {
  if (target instanceof Window) {
    target.scrollBy({ left, top, behavior: "auto" });
  } else {
    target.scrollBy({ left, top, behavior: "auto" });
  }
}

function nextID() {
  return globalThis.crypto?.randomUUID?.() ?? `region-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneRegions(regions: ScreenRegion[]): ScreenRegion[] {
  return regions.map((region) => ({
    ...region,
    rect: { ...region.rect },
    businessRefs: region.businessRefs.map((ref) => ({ ...ref })),
  }));
}

function regionLabel(region: ScreenRegion) {
  const refs = region.businessRefs;
  if (!refs.length) return "页面区域";
  if (refs.length === 1) return refs[0].label || businessRefTypeLabel(refs[0].type);
  const firstType = refs[0].type;
  const sameType = refs.every((ref) => ref.type === firstType);
  return sameType ? `${refs.length} ${businessRefTypeLabel(firstType)}` : `${refs.length} 个业务对象`;
}

function selectedObjectsSummary(regions: ScreenRegion[]) {
  const refs = dedupeBusinessRefs(regions.flatMap((region) => region.businessRefs));
  if (!refs.length) return `${regions.length} 个页面区域`;
  const employees = refs.filter((ref) => ref.type === "employee" || ref.type === "user");
  if (employees.length) {
    return `已选 ${employees.length} 名员工：${joinLabels(employees, 6)}`;
  }
  const grouped = refs.reduce<Record<string, number>>((acc, ref) => {
    acc[ref.type] = (acc[ref.type] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped).map(([type, count]) => `${count} ${businessRefTypeLabel(type)}`).join("、");
}

function dedupeBusinessRefs(refs: BusinessRef[]) {
  const seen = new Set<string>();
  const out: BusinessRef[] = [];
  for (const ref of refs) {
    const key = `${ref.type}:${ref.id}`;
    if (!ref.id || seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function joinLabels(refs: BusinessRef[], limit: number) {
  const labels = refs.map((ref) => ref.label || businessRefTypeLabel(ref.type)).filter(Boolean);
  if (labels.length <= limit) return labels.join("、");
  return `${labels.slice(0, limit).join("、")} 等 ${labels.length} 项`;
}

function businessRefTypeLabel(type: string) {
  switch (type) {
    case "employee":
    case "user":
      return "名员工";
    case "legal_entity":
      return "个法人";
    case "org_unit":
      return "个组织";
    case "rag_document":
      return "份知识资料";
    case "agent_run":
      return "个 Agent run";
    case "audit_event":
      return "条审计事件";
    case "learning":
      return "个学习对象";
    default:
      return "个业务对象";
  }
}

function formatTurnTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}

function isPanelEvent(event: ReactPointerEvent<HTMLElement>) {
  return Boolean((event.target as HTMLElement).closest([
    ".visual-copilot-panel",
    ".visual-copilot-rail",
    ".ant-modal-root",
    ".ant-drawer",
    ".ant-dropdown",
    ".ant-select-dropdown",
    ".ant-picker-dropdown",
    ".ant-popover",
    ".ant-tooltip",
  ].join(", ")));
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], .ant-select, .ant-picker"));
}

function hasVisibleBusinessOverlay() {
  return Array.from(document.querySelectorAll<HTMLElement>(".ant-modal-wrap, .ant-drawer, .ant-dropdown, .ant-select-dropdown, .ant-picker-dropdown, .ant-popover")).some((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  });
}

function riskColor(risk?: string) {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "blue";
}
