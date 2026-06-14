import {
  ApiOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, DatePicker, Drawer, Pagination, Progress, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { Attendance, AttendanceAgentAnalysis, AttendanceException, AttendanceOverview, Employee } from "../../api/types";
import { ExecutionDecisionPanel, TrustMetaBar, TrustPacketBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageLoading } from "../../components/PageLoading";
import { PageTitle } from "../../components/PageTitle";

const statusLabel: Record<number, string> = {
  0: "未签到",
  1: "正常",
  2: "旷工",
  3: "迟到",
  4: "早退",
  5: "外出",
  6: "出差",
  7: "年假",
  8: "事假",
  9: "病假",
  22: "补签",
};

const metricMeta = {
  expected: { title: "应到人数", tone: "blue", icon: <TeamOutlined /> },
  checkedIn: { title: "实到人数", tone: "green", icon: <UsergroupAddOutlined /> },
  notCheckedIn: { title: "未到人数", tone: "red", icon: <ExclamationCircleOutlined /> },
  leave: { title: "请假人数", tone: "purple", icon: <ClockCircleOutlined /> },
  late: { title: "迟到人数", tone: "orange", icon: <FieldTimeOutlined /> },
  earlyLeave: { title: "早退人数", tone: "orange", icon: <FieldTimeOutlined /> },
  fieldOrTrip: { title: "外出/出差", tone: "cyan", icon: <ApiOutlined /> },
  abnormalRate: { title: "异常率", tone: "red", icon: <SafetyCertificateOutlined /> },
} as const;

type DetailFilter =
  | { type: "all" }
  | { type: "metric"; key: keyof typeof metricMeta }
  | { type: "org"; orgUnitName: string }
  | { type: "exception"; exceptionType?: string };

type DetailRow = {
  key: string;
  source: "record" | "exception";
  id: string;
  employeeId: string;
  employeeName: string;
  mobile: string;
  orgUnitName: string;
  day: string;
  attendanceStatus: number;
  statusLabel: string;
  attendanceInTime?: string | null;
  attendanceOutTime?: string | null;
  reason?: string;
  exceptionType?: string;
  severity?: string;
  remarks: string;
};

export function AttendancePage() {
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [analysis, setAnalysis] = useState<AttendanceAgentAnalysis | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [employeeId, setEmployeeId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkoutId, setCheckoutId] = useState("");
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("考勤明细");
  const [detailFilter, setDetailFilter] = useState<DetailFilter>({ type: "all" });
  const [detailPage, setDetailPage] = useState(1);

  const reload = async (day = selectedDay) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.attendanceOverview(day || undefined);
      setOverview(result);
      setSelectedDay(result.day);
    } catch (err) {
      setError(getErrorMessage(err, "考勤态势加载失败"));
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const result = await api.employees(1, 200);
      setEmployees(result.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "员工选项加载失败"));
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    void reload("");
    void loadEmployees();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void reload(selectedDay);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [selectedDay]);

  const metricCards = useMemo(() => {
    if (!overview) return [];
    const abnormalRate = overview.summary.expected ? (overview.summary.abnormal * 100) / overview.summary.expected : 0;
    return [
      { key: "expected", value: overview.summary.expected, suffix: "人" },
      { key: "checkedIn", value: overview.summary.checkedIn, suffix: "人" },
      { key: "notCheckedIn", value: overview.summary.notCheckedIn, suffix: "人" },
      { key: "leave", value: overview.summary.leave, suffix: "人" },
      { key: "late", value: overview.summary.late, suffix: "人" },
      { key: "earlyLeave", value: overview.summary.earlyLeave, suffix: "人" },
      { key: "fieldOrTrip", value: overview.summary.fieldOrTrip, suffix: "人" },
      { key: "abnormalRate", value: Number(abnormalRate.toFixed(1)), suffix: "%" },
    ] as Array<{ key: keyof typeof metricMeta; value: number; suffix: string }>;
  }, [overview]);

  const detailRows = useMemo(() => {
    if (!overview) return [];
    const recordRows = overview.recentRecords.map(recordToDetailRow);
    const exceptionRows = overview.exceptions.map(exceptionToDetailRow);
    if (detailFilter.type === "org") {
      return [
        ...recordRows.filter((row) => row.orgUnitName === detailFilter.orgUnitName),
        ...exceptionRows.filter((row) => row.orgUnitName === detailFilter.orgUnitName && row.exceptionType === "absence"),
      ];
    }
    if (detailFilter.type === "exception") {
      return exceptionRows.filter((row) => !detailFilter.exceptionType || row.exceptionType === detailFilter.exceptionType);
    }
    if (detailFilter.type === "metric") {
      switch (detailFilter.key) {
      case "checkedIn":
        return recordRows.filter((row) => Boolean(row.attendanceInTime));
      case "notCheckedIn":
        return exceptionRows.filter((row) => row.exceptionType === "absence");
      case "leave":
        return recordRows.filter((row) => [7, 8, 9].includes(row.attendanceStatus));
      case "late":
        return exceptionRows.filter((row) => row.exceptionType === "late");
      case "earlyLeave":
        return exceptionRows.filter((row) => row.exceptionType === "early_leave");
      case "fieldOrTrip":
        return recordRows.filter((row) => [5, 6].includes(row.attendanceStatus));
      case "abnormalRate":
        return exceptionRows;
      default:
        return [...recordRows, ...exceptionRows.filter((row) => row.exceptionType === "absence")];
      }
    }
    return [...recordRows, ...exceptionRows.filter((row) => row.exceptionType === "absence")];
  }, [detailFilter, overview]);
  const detailPageSize = 8;
  const mobileDetailRows = useMemo(
    () => detailRows.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize),
    [detailPage, detailRows],
  );

  const openDetails = (title: string, filter: DetailFilter) => {
    setDrawerTitle(title);
    setDetailFilter(filter);
    setDetailPage(1);
    setDrawerOpen(true);
  };

  const runAnalysis = async () => {
    if (!overview) return;
    setAnalysisLoading(true);
    setError("");
    try {
      const result = await api.attendanceAgentAnalysis({ day: overview.day, focus: "overview" });
      setAnalysis(result);
      if (result.overview) setOverview(result.overview);
      message.success("智能分析预览已生成");
    } catch (err) {
      setError(getErrorMessage(err, "智能考勤分析失败"));
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <main className="attendance-page" data-vc-page="attendance-realtime-dashboard" data-vc-kind="attendance-page">
      <PageTitle title="考勤实时态势台" description="先看实时聚合和异常队列，再下钻具体员工；AI 只生成分析预览和人工复核建议，不自动做人事裁决。" />
      <InlineError message={error} onRetry={() => { void reload(); void loadEmployees(); }} />

      <section className="attendance-toolbar" data-vc-kind="attendance-toolbar">
        <Space wrap>
          <DatePicker
            value={selectedDay ? dayjs(selectedDay) : undefined}
            allowClear={false}
            onChange={(value) => {
              const nextDay = value ? value.format("YYYY-MM-DD") : "";
              setSelectedDay(nextDay);
              void reload(nextDay);
            }}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => { void reload(); }}>
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              setError("");
              try {
                await api.exportAttendance();
                message.success("CSV 导出已生成");
              } catch (err) {
                setError(getErrorMessage(err, "考勤导出失败"));
              } finally {
                setExporting(false);
              }
            }}
          >
            导出 CSV
          </Button>
          <Button onClick={() => openDetails("打卡管理与明细", { type: "all" })}>
            打卡管理
          </Button>
        </Space>
        {overview ? (
          <Typography.Text type="secondary">
            数据时间：{dayjs(overview.generatedAt).format("YYYY-MM-DD HH:mm:ss")} · 60 秒自动刷新
          </Typography.Text>
        ) : null}
      </section>

      <Alert
        showIcon
        type="info"
        className="attendance-boundary"
        title="考勤信号只用于流程解释、异常提示和人工复核"
        description="应到人数按当前可见 active 员工估算；请假、外出、出差来自考勤状态码。AI 分析不会自动判定旷工、绩效影响或处分。"
      />

      {loading && !overview ? <PageLoading /> : null}

      {overview ? (
        <section className="attendance-layout">
          <div className="attendance-main">
            <section className="attendance-metric-grid" data-vc-kind="attendance-realtime-metrics">
              {metricCards.map((card) => {
                const meta = metricMeta[card.key];
                return (
                  <button
                    type="button"
                    className={`attendance-metric tone-${meta.tone}`}
                    key={card.key}
                    onClick={() => openDetails(meta.title, { type: "metric", key: card.key })}
                    data-vc-kind="attendance-metric"
                    data-vc-label={meta.title}
                  >
                    <span className="status-icon">{meta.icon}</span>
                    <Statistic title={meta.title} value={card.value} suffix={card.suffix} precision={card.key === "abnormalRate" ? 1 : 0} />
                  </button>
                );
              })}
            </section>

            <section className="attendance-operating-grid">
              <Card title="部门到岗分布" className="attendance-section" data-vc-kind="attendance-org-summary">
                <div className="attendance-org-list">
                  {overview.orgUnits.map((org) => (
                    <button
                      type="button"
                      key={org.orgUnitName}
                      className="attendance-org-row"
                      onClick={() => openDetails(`${org.orgUnitName} 明细`, { type: "org", orgUnitName: org.orgUnitName })}
                    >
                      <span>
                        <Typography.Text strong>{org.orgUnitName}</Typography.Text>
                        <Typography.Text type="secondary">{org.checkedIn}/{org.expected} 已到 · 异常 {org.abnormal}</Typography.Text>
                      </span>
                      <Progress percent={Number(org.attendanceRate.toFixed(1))} size="small" status={org.riskLevel === "high" ? "exception" : org.riskLevel === "medium" ? "active" : "success"} />
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="异常队列" className="attendance-section" extra={<Tag color={riskColor(overview.summary.riskLevel)}>{overview.summary.riskLevel}</Tag>} data-vc-kind="attendance-exception-queue">
                <Table
                  className="hr-desktop-record-table"
                  size="small"
                  rowKey="id"
                  dataSource={overview.exceptions.slice(0, 8)}
                  pagination={false}
                  locale={{ emptyText: <EmptyBlock description="暂无异常信号" /> }}
                  onRow={(row) => ({
                    "data-vc-kind": "attendance-exception-row",
                    "data-vc-object-type": "attendance",
                    "data-vc-object-id": row.id,
                    "data-vc-label": `${row.employeeName} ${row.statusLabel}`,
                  } as HTMLAttributes<HTMLElement>)}
                  columns={[
                    { title: "员工", dataIndex: "employeeName" },
                    { title: "组织", dataIndex: "orgUnitName" },
                    { title: "信号", dataIndex: "statusLabel", render: (_, row: AttendanceException) => <Tag color={riskColor(row.severity)}>{row.statusLabel}</Tag> },
                    { title: "原因", dataIndex: "reason", ellipsis: true },
                    {
                      title: "操作",
                      render: (_, row: AttendanceException) => (
                        <Button size="small" type="link" aria-label={`查看${row.employeeName}${row.statusLabel}明细`} onClick={() => openDetails(`${row.statusLabel}明细`, { type: "exception", exceptionType: row.exceptionType })}>
                          查看明细
                        </Button>
                      ),
                    },
                  ]}
                />
                <div className="hr-mobile-record-list">
                  {!overview.exceptions.length ? <EmptyBlock description="暂无异常信号" /> : null}
                  {overview.exceptions.slice(0, 8).map((row) => (
                    <button
                      type="button"
                      className="hr-mobile-record-card"
                      key={row.id}
                      onClick={() => openDetails(`${row.statusLabel}明细`, { type: "exception", exceptionType: row.exceptionType })}
                      aria-label={`查看${row.employeeName}${row.statusLabel}明细`}
                      data-vc-action="attendance.detail"
                      data-vc-kind="attendance-exception-mobile-card"
                      data-vc-object-type="attendance"
                      data-vc-object-id={row.id}
                      data-vc-label={`${row.employeeName} ${row.statusLabel}`}
                    >
                      <span className="hr-mobile-card-title">{row.employeeName}</span>
                      <span className="hr-mobile-card-meta">{row.orgUnitName}</span>
                      <span className="hr-mobile-card-tags">
                        <Tag color={riskColor(row.severity)}>{row.statusLabel}</Tag>
                      </span>
                      <Typography.Text type="secondary">{row.reason || row.remarks || "-"}</Typography.Text>
                      <span className="hr-mobile-card-action">查看明细</span>
                    </button>
                  ))}
                </div>
                {overview.exceptions.length > 8 ? (
                  <Button type="link" onClick={() => openDetails("全部异常信号", { type: "exception" })}>
                    查看全部 {overview.exceptions.length} 条异常
                  </Button>
                ) : null}
              </Card>
            </section>
          </div>

          <aside className="attendance-agent-panel" data-vc-kind="attendance-agent-analysis">
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              <Space align="start">
                <span className="status-icon tone-purple"><RobotOutlined /></span>
                <div>
                  <Typography.Title level={4}>智能实时分析</Typography.Title>
                  <Typography.Paragraph type="secondary">
                    基于当前可见范围的考勤快照生成预览式洞察，工具只读，所有处置建议都需要 HR 人工复核。
                  </Typography.Paragraph>
                </div>
              </Space>
              <Button type="primary" block icon={<RobotOutlined />} loading={analysisLoading} onClick={runAnalysis}>
                生成智能分析预览
              </Button>
              {analysis ? (
                <div className="attendance-agent-result">
                  <TrustMetaBar
                    riskLevel={analysis.trustPacket?.riskLevel ?? analysis.run.riskLevel}
                    confidence={Math.round((analysis.trustPacket?.confidence ?? 0.86) * 100)}
                    evidenceCount={analysis.trustPacket?.evidenceCount ?? 0}
                    humanReviewRequired
                    toolPreview={Boolean(analysis.toolPreview)}
                    auditStatus={analysis.trustPacket?.auditStatus ?? "previewed"}
                  />
                  <TrustPacketBar packet={analysis.trustPacket} />
                  <ExecutionDecisionPanel decision={analysis.executionDecision} />
                  <div className="attendance-agent-list">
                    <Typography.Text strong>洞察</Typography.Text>
                    {analysis.insights.map((item) => <p key={item}>{item}</p>)}
                  </div>
                  <div className="attendance-agent-list">
                    <Typography.Text strong>建议动作</Typography.Text>
                    {analysis.recommendedActions.map((item) => <p key={item}>{item}</p>)}
                  </div>
                  <Space wrap>
                    {analysis.auditPreview.map((event) => <Tag icon={<AuditOutlined />} key={event}>{event}</Tag>)}
                  </Space>
                </div>
              ) : (
                <Alert showIcon type="warning" title="尚未生成分析" description="点击按钮后会创建智能任务预览和只读动作草稿，不会执行写操作。" />
              )}
            </Space>
          </aside>
        </section>
      ) : null}

      <Drawer
        title={`${drawerTitle}（${detailRows.length} 条）`}
        open={drawerOpen}
        size="min(736px, 100vw)"
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
      >
        <Space className="attendance-drawer-toolbar" wrap>
          <Select
            data-vc-field="attendance.employee_select"
            showSearch
            optionFilterProp="label"
            placeholder="选择员工签到"
            value={employeeId}
            loading={employeesLoading}
            style={{ width: 260 }}
            options={employees.map((employee) => ({ value: employee.id, label: `${employee.name} · ${employee.employeeNo}` }))}
            onChange={setEmployeeId}
          />
          <Button
            type="primary"
            data-vc-action="attendance.checkin"
            disabled={!employeeId}
            loading={actionLoading}
            onClick={async () => {
              if (!employeeId) return;
              setActionLoading(true);
              setError("");
              try {
                await api.checkin(employeeId);
                await reload("");
                message.success("签到已记录，考勤态势已刷新");
              } catch (err) {
                setError(getErrorMessage(err, "签到失败"));
              } finally {
                setActionLoading(false);
              }
            }}
          >
            签到
          </Button>
          <Button loading={exporting} icon={<DownloadOutlined />} onClick={async () => {
            setExporting(true);
            setError("");
            try {
              await api.exportAttendance();
              message.success("CSV 导出已生成");
            } catch (err) {
              setError(getErrorMessage(err, "考勤导出失败"));
            } finally {
              setExporting(false);
            }
          }}>
            导出 CSV
          </Button>
        </Space>
        <Table
          className="hr-desktop-record-table"
          data-vc-kind="attendance-detail-table"
          rowKey="key"
          dataSource={detailRows}
          pagination={{ pageSize: 8 }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <EmptyBlock description="暂无明细记录" /> }}
          columns={[
            { title: "员工", dataIndex: "employeeName", width: 120 },
            { title: "手机号", dataIndex: "mobile", width: 150 },
            { title: "组织", dataIndex: "orgUnitName", width: 220 },
            { title: "日期", dataIndex: "day", width: 120 },
            { title: "状态", dataIndex: "statusLabel", width: 100, render: (_, row: DetailRow) => <Tag color={riskColor(row.severity ?? statusRisk(row.attendanceStatus))}>{row.statusLabel}</Tag> },
            { title: "签到", dataIndex: "attendanceInTime", width: 170, render: (value) => value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-" },
            { title: "签退", dataIndex: "attendanceOutTime", width: 170, render: (value) => value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-" },
            { title: "说明", dataIndex: "reason", width: 280, render: (_, row: DetailRow) => row.reason || row.remarks || "-" },
            { title: "操作", width: 110, fixed: "right", render: (_, row: DetailRow) => (
              <Button
                data-vc-action="attendance.checkout"
                disabled={row.source !== "record" || !row.attendanceInTime || !!row.attendanceOutTime}
                loading={checkoutId === row.id}
                onClick={async () => {
                  setCheckoutId(row.id);
                  setError("");
                  try {
                    await api.checkout(row.id);
                    await reload(selectedDay);
                    message.success("签退已记录，考勤态势已刷新");
                  } catch (err) {
                    setError(getErrorMessage(err, "签退失败"));
                  } finally {
                    setCheckoutId("");
                  }
                }}
              >
                签退
              </Button>
            ) },
          ]}
        />
        <div className="hr-mobile-record-list" data-vc-kind="attendance-detail-mobile-list">
          {!detailRows.length ? <EmptyBlock description="暂无明细记录" /> : null}
          {mobileDetailRows.map((row) => (
            <article className="hr-mobile-record-card" key={row.key} data-vc-kind="attendance-detail-mobile-card" data-vc-object-type="attendance" data-vc-object-id={row.id} data-vc-label={`${row.employeeName} ${row.statusLabel}`}>
              <span className="hr-mobile-card-title">{row.employeeName}</span>
              <span className="hr-mobile-card-meta">{row.mobile} · {row.orgUnitName}</span>
              <span className="hr-mobile-card-tags">
                <Tag color={riskColor(row.severity ?? statusRisk(row.attendanceStatus))}>{row.statusLabel}</Tag>
                <Tag>{row.day}</Tag>
              </span>
              <Typography.Text type="secondary">签到：{row.attendanceInTime ? dayjs(row.attendanceInTime).format("HH:mm") : "-"}</Typography.Text>
              <Typography.Text type="secondary">签退：{row.attendanceOutTime ? dayjs(row.attendanceOutTime).format("HH:mm") : "-"}</Typography.Text>
              <Typography.Text type="secondary">{row.reason || row.remarks || "-"}</Typography.Text>
              <Button
                size="small"
                data-vc-action="attendance.checkout"
                disabled={row.source !== "record" || !row.attendanceInTime || !!row.attendanceOutTime}
                loading={checkoutId === row.id}
                onClick={async () => {
                  setCheckoutId(row.id);
                  setError("");
                  try {
                    await api.checkout(row.id);
                    await reload(selectedDay);
                    message.success("签退已记录，考勤态势已刷新");
                  } catch (err) {
                    setError(getErrorMessage(err, "签退失败"));
                  } finally {
                    setCheckoutId("");
                  }
                }}
              >
                签退
              </Button>
            </article>
          ))}
          {detailRows.length > detailPageSize ? (
            <Pagination
              className="hr-mobile-pagination"
              size="small"
              current={detailPage}
              pageSize={detailPageSize}
              total={detailRows.length}
              showSizeChanger={false}
              onChange={setDetailPage}
            />
          ) : null}
        </div>
      </Drawer>
    </main>
  );
}

function recordToDetailRow(record: Attendance): DetailRow {
  return {
    key: `record-${record.id}`,
    source: "record",
    id: record.id,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    mobile: record.mobile,
    orgUnitName: record.orgUnitName,
    day: record.day,
    attendanceStatus: record.attendanceStatus,
    statusLabel: statusLabel[record.attendanceStatus] ?? "未签到",
    attendanceInTime: record.attendanceInTime,
    attendanceOutTime: record.attendanceOutTime,
    remarks: record.remarks,
  };
}

function exceptionToDetailRow(exception: AttendanceException): DetailRow {
  return {
    key: `exception-${exception.id}`,
    source: "exception",
    id: exception.id,
    employeeId: exception.employeeId,
    employeeName: exception.employeeName,
    mobile: exception.mobile,
    orgUnitName: exception.orgUnitName,
    day: exception.day,
    attendanceStatus: exception.attendanceStatus,
    statusLabel: exception.statusLabel,
    attendanceInTime: exception.attendanceInTime,
    attendanceOutTime: exception.attendanceOutTime,
    reason: exception.reason,
    exceptionType: exception.exceptionType,
    severity: exception.severity,
    remarks: exception.remarks,
  };
}

function riskColor(risk: string) {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  if (risk === "low") return "green";
  return "blue";
}

function statusRisk(status: number) {
  if (status === 2 || status === 3 || status === 4) return "medium";
  return "low";
}
