import { AimOutlined, CloseOutlined, DeleteOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Input, Space, Tag, Tooltip, Typography, message } from "antd";
import type { MouseEvent } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";
import type { BusinessRef, ScreenRegion, VisualCopilotResponse } from "../api/types";

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

  const start = (event: MouseEvent<HTMLDivElement>) => {
    if (!active || isPanelEvent(event)) {
      return;
    }
    const point = { x: event.clientX, y: event.clientY };
    setOrigin(point);
    setDraft({ x: point.x, y: point.y, width: 0, height: 0, dpr: window.devicePixelRatio || 1 });
  };

  const move = (event: MouseEvent<HTMLDivElement>) => {
    if (!active || !origin) {
      return;
    }
    setDraft(toRect(origin.x, origin.y, event.clientX, event.clientY));
  };

  const end = (event: MouseEvent<HTMLDivElement>) => {
    if (!active || !origin || !draft) {
      return;
    }
    const rect = toRect(origin.x, origin.y, event.clientX, event.clientY);
    const refs = refsAt(event.clientX, event.clientY);
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
        dom: domSnapshot(),
        regions,
        instruction,
      });
      setResponse(result);
      message.success("Visual Copilot 已生成建议");
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
          className="visual-copilot-fab"
          shape="circle"
          type={active ? "primary" : "default"}
          icon={<AimOutlined />}
          onClick={() => setActive((value) => !value)}
          data-vc-action="visual_copilot.toggle"
        />
      </Tooltip>
      {active ? createPortal(
        <div className="visual-copilot-layer" onMouseDown={start} onMouseMove={move} onMouseUp={end}>
          {regions.map((region) => <RegionBox key={region.id} region={region} />)}
          {draft ? <div className="visual-region draft" style={rectStyle(draft)} /> : null}
          <div className="visual-copilot-panel" data-vc-kind="visual-copilot-panel">
            <Space align="start">
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
              <Button icon={<DeleteOutlined />} onClick={() => { setRegions([]); setResponse(null); }} />
              <Button icon={<CloseOutlined />} onClick={() => setActive(false)} />
            </Space>
            {response ? (
              <div className="visual-response">
                <Typography.Paragraph>
                  {response.result.preview}
                </Typography.Paragraph>
                <Space wrap>
                  {response.result.actions.map((action, index) => (
                    <Tag
                      key={`${String(action.type ?? "action")}-${index}`}
                      color={action.blocked ? "red" : action.riskLevel === "high" ? "orange" : "blue"}
                    >
                      {String(action.label ?? action.type)} · risk={String(action.riskLevel ?? "low")}{action.blocked ? " · blocked" : ""}
                    </Tag>
                  ))}
                </Space>
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

function domSnapshot() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-vc-kind], [data-vc-action], [data-vc-field], [data-vc-object-type]"))
    .slice(0, 160)
    .map((element) => ({
      kind: element.dataset.vcKind,
      action: element.dataset.vcAction,
      field: element.dataset.vcField,
      objectType: element.dataset.vcObjectType,
      objectId: element.dataset.vcObjectId,
      label: element.dataset.vcLabel || element.getAttribute("aria-label") || element.dataset.vcAction || element.dataset.vcField,
      tag: element.tagName.toLowerCase(),
      visible: element.offsetParent !== null,
    }));
}

function nextID() {
  return globalThis.crypto?.randomUUID?.() ?? `region-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPanelEvent(event: MouseEvent<HTMLElement>) {
  return Boolean((event.target as HTMLElement).closest(".visual-copilot-panel"));
}
