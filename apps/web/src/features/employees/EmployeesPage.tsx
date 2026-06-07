import { Alert, Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag } from "antd";
import dayjs from "dayjs";
import { useEffect, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { Assignment, Employee, LegalEntity, OrgUnit } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

type EmployeeEditor = Omit<Partial<Employee>, "primaryAssignment"> & {
  primaryAssignment?: Record<string, unknown>;
};

export function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editingAssignments, setEditingAssignments] = useState(false);
  const [editing, setEditing] = useState<EmployeeEditor | null>(null);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const [assignmentForm] = Form.useForm();

  const reload = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.employees(nextPage, 10);
      setItems(result.rows ?? []);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(getErrorMessage(err, "员工列表加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(1); }, []);

  useEffect(() => {
    void Promise.all([api.legalEntities(), api.orgUnits()])
      .then(([entities, units]) => {
        setLegalEntities(entities);
        setOrgUnits(units);
      })
      .catch((err) => setError(getErrorMessage(err, "员工选项加载失败")));
  }, []);

  useEffect(() => {
    if (!selected) {
      setAssignments([]);
      return;
    }
    void api.employeeAssignments(selected.id)
      .then((items) => setAssignments(items ?? []))
      .catch((err) => setError(getErrorMessage(err, "任职记录加载失败")));
  }, [selected]);

  const openEditor = (employee?: Employee) => {
    if (employee) {
      setEditing({
        ...employee,
        primaryAssignment: employee.primaryAssignment ? {
          ...employee.primaryAssignment,
          startDate: employee.primaryAssignment.startDate ? dayjs(employee.primaryAssignment.startDate) : undefined,
        } : undefined,
      });
      return;
    }
    setEditing({ status: "active", primaryAssignment: { employmentType: "full_time" } });
  };

  return (
    <main data-vc-page="employee-data-layer" data-vc-kind="employees-page">
      <PageTitle title="员工数据层" description="维护员工档案、任职和组织关系，为 AI 建议、scope 控制、Agent 预览和审计证据提供可信数据。" />
      <Alert className="section-card" type="info" showIcon title="当前员工档案为合成样本，用于演示权限、组织关系和审计流程；不是任何真实员工数据。" />
      <InlineError message={error} onRetry={() => reload()} />
      <Space className="toolbar">
        <Button type="primary" data-vc-action="employee.create" onClick={() => openEditor()}>新增员工</Button>
        <Button
          data-vc-action="employee.export"
          loading={exporting}
          onClick={async () => {
            setExporting(true);
            setError("");
            try {
              await api.exportEmployees();
            } catch (err) {
              setError(getErrorMessage(err, "员工导出失败"));
            } finally {
              setExporting(false);
            }
          }}
        >
          导出 CSV
        </Button>
      </Space>
      <Table
        data-vc-kind="employee-table"
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={{ total, current: page, onChange: reload, pageSize: 10 }}
        locale={{ emptyText: <EmptyBlock description="暂无员工" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "employee",
          "data-vc-object-id": row.id,
          "data-vc-label": row.name,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "姓名", dataIndex: "name" },
          { title: "工号", dataIndex: "employeeNo" },
          { title: "手机号", dataIndex: "mobile" },
          { title: "法人", render: (_, row) => row.primaryAssignment?.legalEntityName ?? "未分配" },
          { title: "组织", render: (_, row) => row.primaryAssignment?.orgUnitName ?? "未分配" },
          { title: "状态", dataIndex: "status", render: (status) => <Tag color="green">{status}</Tag> },
          {
            title: "操作",
            render: (_, row) => (
              <Space>
                <Button data-vc-action="employee.detail" onClick={() => setSelected(row)}>详情</Button>
                <Button data-vc-action="employee.edit" onClick={() => openEditor(row)}>编辑</Button>
              </Space>
            ),
          },
        ]}
      />
      <Drawer title="员工详情" open={!!selected} onClose={() => setSelected(null)} size="large" data-vc-kind="employee-drawer" data-vc-object-type={selected ? "employee" : undefined} data-vc-object-id={selected?.id} data-vc-label={selected?.name}>
        {selected ? (
          <>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="姓名">{selected.name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{selected.mobile}</Descriptions.Item>
              <Descriptions.Item label="主任职法人">{selected.primaryAssignment?.legalEntityName ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="主任职组织">{selected.primaryAssignment?.orgUnitName ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="学历">{selected.highestDegreeOfEducation || "-"}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{selected.idNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="毕业学校">{selected.graduateSchool || "-"}</Descriptions.Item>
              <Descriptions.Item label="专业">{selected.major || "-"}</Descriptions.Item>
              <Descriptions.Item label="现居住地">{selected.placeOfResidence || "-"}</Descriptions.Item>
              <Descriptions.Item label="备注">{selected.remarks || "-"}</Descriptions.Item>
            </Descriptions>
            <Space className="toolbar">
              <Button
                data-vc-action="employee.assignments.edit"
                onClick={() => {
                  assignmentForm.setFieldsValue({
                    assignments: assignments.map((item) => ({
                      ...item,
                      startDate: item.startDate ? dayjs(item.startDate) : undefined,
                      endDate: item.endDate ? dayjs(item.endDate) : undefined,
                    })),
                  });
                  setEditingAssignments(true);
                }}
              >
                维护任职
              </Button>
            </Space>
            <Table
              data-vc-kind="employee-assignment-table"
              rowKey="id"
              pagination={false}
              dataSource={assignments}
              columns={[
                { title: "法人", dataIndex: "legalEntityName" },
                { title: "组织", dataIndex: "orgUnitName" },
                { title: "岗位", dataIndex: "positionTitle" },
                { title: "主岗", dataIndex: "isPrimary", render: (value) => value ? <Tag color="green">主岗</Tag> : <Tag>兼岗</Tag> },
                { title: "比例", dataIndex: "allocationRatio", render: (value) => value ? `${value}%` : "-" },
                { title: "状态", render: (_, row) => row.endDate ? <Tag>历史</Tag> : <Tag color="blue">在任</Tag> },
              ]}
            />
          </>
        ) : null}
      </Drawer>
      <Modal
        title={editing?.id ? "编辑员工" : "新增员工"}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing ?? {}}
          key={editing?.id ?? "new"}
          onFinish={async (values) => {
            const startDate = values.primaryAssignment?.startDate;
            const payload = {
              ...values,
              status: values.status || "active",
              primaryAssignment: values.primaryAssignment ? {
                ...values.primaryAssignment,
                startDate: startDate?.toISOString ? startDate.toISOString() : startDate,
              } : undefined,
            };
            setSaving(true);
            setError("");
            try {
              if (editing?.id) {
                await api.updateEmployee(editing.id, payload);
              } else {
                await api.createEmployee(payload);
              }
              setEditing(null);
              form.resetFields();
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "员工保存失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="employeeNo" label="工号" rules={[{ required: true }]}><Input disabled={!!editing?.id} /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mobile" label="手机号"><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Input /></Form.Item>
          <Form.Item name="highestDegreeOfEducation" label="最高学历"><Input /></Form.Item>
          <Form.Item name="idNumber" label="身份证号"><Input /></Form.Item>
          <Form.Item name={["primaryAssignment", "legalEntityId"]} label="主任职法人">
            <Select allowClear options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item name={["primaryAssignment", "orgUnitId"]} label="主任职组织">
            <Select allowClear options={orgUnits.map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item name={["primaryAssignment", "positionTitle"]} label="岗位"><Input /></Form.Item>
          <Form.Item name={["primaryAssignment", "startDate"]} label="任职开始日期"><DatePicker /></Form.Item>
          <Form.Item name={["primaryAssignment", "employmentType"]} label="用工类型">
            <Select options={[
              { value: "full_time", label: "全职" },
              { value: "part_time", label: "兼职" },
              { value: "contractor", label: "外包/合同" },
            ]} />
          </Form.Item>
          <Form.Item name="remarks" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
      <Modal
        title="维护任职"
        open={editingAssignments}
        onCancel={() => setEditingAssignments(false)}
        onOk={() => assignmentForm.submit()}
        width={900}
      >
        <Form
          form={assignmentForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!selected) {
              return;
            }
            const payload = (values.assignments ?? []).map((item: Record<string, any>) => ({
              ...item,
              startDate: item.startDate?.toISOString ? item.startDate.toISOString() : item.startDate,
              endDate: item.endDate?.toISOString ? item.endDate.toISOString() : item.endDate,
            }));
            try {
              const saved = await api.updateEmployeeAssignments(selected.id, payload);
              setAssignments(saved);
              setEditingAssignments(false);
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "任职保存失败"));
            }
          }}
        >
          <Form.List name="assignments">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: "100%" }}>
                {fields.map((field) => (
                  <div className="assignment-row" key={field.key}>
                    <Form.Item name={[field.name, "legalEntityId"]} label="法人">
                      <Select allowClear options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, "orgUnitId"]} label="组织">
                      <Select allowClear options={orgUnits.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, "positionTitle"]} label="岗位"><Input /></Form.Item>
                    <Form.Item name={[field.name, "allocationRatio"]} label="比例"><InputNumber min={0} max={100} /></Form.Item>
                    <Form.Item name={[field.name, "startDate"]} label="开始"><DatePicker /></Form.Item>
                    <Form.Item name={[field.name, "endDate"]} label="结束"><DatePicker allowClear /></Form.Item>
                    <Form.Item name={[field.name, "isPrimary"]} label="主岗" valuePropName="checked"><Switch /></Form.Item>
                    <Button danger onClick={() => remove(field.name)}>删除</Button>
                  </div>
                ))}
                <Button onClick={() => add({ employmentType: "full_time", startDate: dayjs(), allocationRatio: 100 })}>
                  新增任职
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </main>
  );
}
