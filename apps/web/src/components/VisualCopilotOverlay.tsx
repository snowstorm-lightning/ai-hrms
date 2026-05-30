import { AimOutlined, CheckCircleOutlined, CloseOutlined, DeleteOutlined, InfoCircleOutlined, SendOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Space, Tag, Tooltip, Typography, message } from "antd";
import type { PointerEvent } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";
import type { BusinessRef, ScreenRegion, VisualCopilotResponse } from "../api/types";
import { ContextPacketPanel, ExecutionDecisionPanel, TrustPacketBar } from "./AiTrust";

type DraftRect = ScreenRegion["rect"] | null;

export function VisualCopilotOverlay() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [regions, setRegions] = useState<ScreenRegion[]>([]);
  const [draft, setDraft] = useState<DraftRect>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [response, setResponse] = useState<VisualCopilotResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!active) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActive(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [active]);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (!active || isPanelEvent(event)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    setOrigin(point);
    setDraft({ x: point.x, y: point.y, width: 0, height: 0, dpr: window.devicePixelRatio || 1 });
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!active || !origin) {
      return;
    }
    setDraft(toRect(origin.x, origin.y, event.clientX, event.clientY));
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!active || !origin || !draft) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const rect = toRect(origin.x, origin.y, event.clientX, event.clientY);
    const matchedRefs = refsInRect(rect);
    const refs = matchedRefs.length ? matchedRefs : refsAt(event.clientX, event.clientY);
    setRegions((current) => [
      ...current,
      { id: nextID(), mode: "rect", rect, businessRefs: refs },
    ]);
    setOrigin(null);
    setDraft(null);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await api.visualSuggestions({
        route: location.pathname,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        dom: domSnapshot(regions),
        regions,
        instruction,
      });
      setResponse(result);
      message.success("Visual Copilot 解释已生成");
    } catch (err) {
      message.error(getErrorMessage(err, "Visual Copilot 提交失败"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Tooltip title="Visual Copilot">
        <Button
          className={active ? "visual-copilot-fab is-active" : "visual-copilot-fab"}
          shape="circle"
          type={active ? "primary" : "default"}
          icon={<AimOutlined />}
          onClick={() => setActive((value) => !value)}
          data-vc-action="visual_copilot.toggle"
        />
      </Tooltip>
      {active ? createPortal(
        <div className="visual-copilot-layer" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { setOrigin(null); setDraft(null); }}>
          {regions.map((region) => <RegionBox key={region.id} region={region} />)}
          {draft ? <div className="visual-region draft" style={rectStyle(draft)} /> : null}
          <div className="visual-copilot-panel" data-vc-kind="visual-copilot-panel" onPointerDown={(event) => event.stopPropagation()}>
            <div className="visual-copilot-panel-header">
              <div>
                <Typography.Text strong>Visual Copilot</Typography.Text>
                <Typography.Text type="secondary">
                  DOM + 业务对象上下文解释，不做图片识别
                </Typography.Text>
              </div>
              <Button aria-label="关闭 Visual Copilot" title="关闭" icon={<CloseOutlined />} onClick={() => setActive(false)} />
            </div>
            <div className="visual-copilot-toolbar">
              <Input.TextArea
                rows={2}
                placeholder="说明这些选区的问题、修改或解释需求"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                data-vc-field="visual_copilot.instruction"
              />
              <Button icon={<SendOutlined />} type="primary" loading={submitting} onClick={submit} disabled={!regions.length}>
                提交
              </Button>
              <Button aria-label="清空选区" title="清空选区" icon={<DeleteOutlined />} onClick={() => { setRegions([]); setResponse(null); }} />
            </div>
            {response ? (
              <div className="visual-response">
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
                  <TrustPacketBar packet={response.trustPacket ?? response.result.trustPacket} />
                  <Tag color={riskColor(response.result.riskLevel)}>risk={response.result.riskLevel || "low"}</Tag>
                  <Tag color="geekblue">confidence={Math.round((response.result.confidence ?? response.event.confidence) * 100)}%</Tag>
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
                  type="info"
                  showIcon
                  title={response.result.trustBoundary || "当前解释基于页面上下文和业务对象引用，不代表已完成图片视觉识别。"}
                />
                <ExecutionDecisionPanel decision={response.executionDecision ?? response.result.executionDecision} />
                <ContextPacketPanel packet={response.contextPacket ?? response.result.contextPacket} />
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function RegionBox({ region }: { region: ScreenRegion }) {
  return (
    <div className="visual-region" style={rectStyle(region.rect)}>
      <span>{region.businessRefs[0]?.label || region.businessRefs[0]?.type || "区域"}</span>
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

function rectStyle(rect: ScreenRegion["rect"]) {
  return {
    left: rect.x,
    top: rect.y,
    width: Math.max(rect.width, 8),
    height: Math.max(rect.height, 8),
  };
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
  const refs = new Map<string, { ref: BusinessRef; area: number }>();
  document.querySelectorAll<HTMLElement>("[data-vc-object-type][data-vc-object-id]").forEach((element) => {
    if (element.offsetParent === null) {
      return;
    }
    const box = element.getBoundingClientRect();
    const area = intersectionArea(rect, box);
    if (area < 16) {
      return;
    }
    const ref: BusinessRef = {
      type: element.dataset.vcObjectType as BusinessRef["type"],
      id: element.dataset.vcObjectId || "",
      label: element.dataset.vcLabel || element.getAttribute("aria-label") || undefined,
    };
    refs.set(`${ref.type}:${ref.id}`, { ref, area });
  });
  return Array.from(refs.values())
    .sort((left, right) => right.area - left.area)
    .slice(0, 8)
    .map((item) => item.ref);
}

function intersectionArea(rect: ScreenRegion["rect"], box: DOMRect) {
  const width = Math.max(0, Math.min(rect.x + rect.width, box.right) - Math.max(rect.x, box.left));
  const height = Math.max(0, Math.min(rect.y + rect.height, box.bottom) - Math.max(rect.y, box.top));
  return width * height;
}

function domSnapshot(regions: ScreenRegion[]) {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-vc-kind], [data-vc-action], [data-vc-field], [data-vc-object-type]"))
    .filter((element) => !element.closest(".visual-copilot-panel"))
    .map((element) => {
      const box = element.getBoundingClientRect();
      return {
        box,
        kind: element.dataset.vcKind,
        action: element.dataset.vcAction,
        field: element.dataset.vcField,
        objectType: element.dataset.vcObjectType,
        objectId: element.dataset.vcObjectId,
        label: element.dataset.vcLabel || element.getAttribute("aria-label") || element.dataset.vcAction || element.dataset.vcField || compactText(element),
        text: compactText(element),
        tag: element.tagName.toLowerCase(),
        visible: element.offsetParent !== null,
        rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    })
    .filter((node) => node.visible && regions.some((region) => intersectionArea(region.rect, node.box) > 0))
    .slice(0, 24)
    .map(({ box: _box, ...node }) => node);
}

function compactText(element: HTMLElement) {
  const text = (element.innerText || element.textContent || "")
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b1[3-9]\d{9}\b/g, "[mobile]")
    .replace(/\b\d{12,19}\b/g, "[number]")
    .replace(/\b\d{15}(\d{2}[0-9Xx])?\b/g, "[id]")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function nextID() {
  return globalThis.crypto?.randomUUID?.() ?? `region-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPanelEvent(event: PointerEvent<HTMLElement>) {
  return Boolean((event.target as HTMLElement).closest(".visual-copilot-panel"));
}

function riskColor(risk?: string) {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "blue";
}
