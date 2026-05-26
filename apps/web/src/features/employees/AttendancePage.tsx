import { Button, Select, Space, Table, Tag } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { Attendance, Employee } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

const statusLabel: Record<number, string> = {
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

export function AttendancePage() {
  const [items, setItems] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkoutId, setCheckoutId] = useState("");
  const [error, setError] = useState("");

  const reload = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.attendance(nextPage, 10);
      setItems(result.rows ?? []);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(getErrorMessage(err, "考勤记录加载失败"));
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const result = await api.employees(1, 100);
      setEmployees(result.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "员工选项加载失败"));
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    void reload(1);
    void loadEmployees();
  }, []);

  return (
    <>
      <PageTitle title="考勤管理" description="查看员工签到、签退和异常考勤状态。" />
      <InlineError message={error} onRetry={() => { void reload(); void loadEmployees(); }} />
      <Space className="toolbar">
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="选择员工签到"
          value={employeeId}
          loading={employeesLoading}
          style={{ width: 240 }}
          options={employees.map((employee) => ({ value: employee.id, label: `${employee.name} · ${employee.employeeNo}` }))}
          onChange={setEmployeeId}
        />
        <Button type="primary" disabled={!employeeId} loading={actionLoading} onClick={async () => {
          if (!employeeId) return;
          setActionLoading(true);
          setError("");
          try {
            await api.checkin(employeeId);
            await reload();
          } catch (err) {
            setError(getErrorMessage(err, "签到失败"));
          } finally {
            setActionLoading(false);
          }
        }}>签到</Button>
        <Button
          loading={exporting}
          onClick={async () => {
            setExporting(true);
            setError("");
            try {
              await api.exportAttendance();
            } catch (err) {
              setError(getErrorMessage(err, "考勤导出失败"));
            } finally {
              setExporting(false);
            }
          }}
        >
          导出 CSV
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={{ total, current: page, onChange: reload }}
        locale={{ emptyText: <EmptyBlock description="暂无考勤记录" /> }}
        columns={[
          { title: "员工", dataIndex: "employeeName" },
          { title: "手机号", dataIndex: "mobile" },
          { title: "组织", dataIndex: "orgUnitName" },
          { title: "日期", dataIndex: "day" },
          { title: "状态", dataIndex: "attendanceStatus", render: (value) => <Tag>{statusLabel[value] ?? "未打卡"}</Tag> },
          { title: "签到", dataIndex: "attendanceInTime", render: (value) => value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-" },
          { title: "签退", dataIndex: "attendanceOutTime", render: (value) => value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-" },
          { title: "操作", render: (_, row) => (
            <Button
              disabled={!!row.attendanceOutTime}
              loading={checkoutId === row.id}
              onClick={async () => {
                setCheckoutId(row.id);
                setError("");
                try {
                  await api.checkout(row.id);
                  await reload();
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
    </>
  );
}
