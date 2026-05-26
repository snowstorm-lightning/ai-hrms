import { Button, Form, Input, Modal, Select, Space, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { LegalEntity, OrgUnit } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageLoading } from "../../components/PageLoading";
import { PageTitle } from "../../components/PageTitle";

function toTree(items: OrgUnit[]): DataNode[] {
  const map = new Map<string, DataNode & { parentId?: string | null }>();
  items.forEach((item) => map.set(item.id, { key: item.id, title: item.name, parentId: item.parentId, children: [] }));
  const roots: DataNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function OrgUnitsPage() {
  const [items, setItems] = useState<OrgUnit[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [editing, setEditing] = useState<Partial<OrgUnit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const treeData = useMemo(() => toTree(items), [items]);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [units, entities] = await Promise.all([api.orgUnits(), api.legalEntities()]);
      setItems(units);
      setLegalEntities(entities);
    } catch (err) {
      setError(getErrorMessage(err, "组织单元加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  return (
    <>
      <PageTitle title="组织单元" description="维护部门、共享中心、分支和跨法人项目组。" />
      <InlineError message={error} onRetry={reload} />
      <Space className="toolbar">
        <Button type="primary" onClick={() => setEditing({ type: "department", status: "active" })}>新增组织单元</Button>
      </Space>
      {loading ? <PageLoading /> : (
        <div className="split-panel">
          <div className="tree-panel">
            {treeData.length ? <Tree treeData={treeData} defaultExpandAll /> : <EmptyBlock description="暂无组织单元" />}
          </div>
          <div className="detail-panel">
            {items.length ? items.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.code} · {item.type} · {legalEntities.find((entity) => entity.id === item.legalEntityId)?.name ?? "不绑定法人"}</span>
                </div>
                <Button onClick={() => setEditing(item)}>编辑</Button>
              </div>
            )) : <EmptyBlock description="暂无组织单元" />}
          </div>
        </div>
      )}
      <Modal title={editing?.id ? "编辑组织单元" : "新增组织单元"} open={!!editing} onCancel={() => setEditing(null)} onOk={() => form.submit()} confirmLoading={saving}>
        <Form
          form={form}
          layout="vertical"
          initialValues={editing ?? {}}
          key={editing?.id ?? "new"}
          onFinish={async (values) => {
            const payload = { ...values, parentId: values.parentId || null, legalEntityId: values.legalEntityId || null };
            setSaving(true);
            setError("");
            try {
              if (editing?.id) {
                await api.updateOrgUnit(editing.id, payload);
              } else {
                await api.createOrgUnit(payload);
              }
              setEditing(null);
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "组织单元保存失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="parentId" label="上级组织"><Select allowClear options={items.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="legalEntityId" label="所属法人"><Select allowClear options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="type" label="类型"><Select options={["department", "center", "branch", "project", "shared"].map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="managerName" label="负责人"><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
