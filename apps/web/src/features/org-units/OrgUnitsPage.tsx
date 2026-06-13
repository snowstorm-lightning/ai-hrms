import { Button, Form, Input, Modal, Popconfirm, Select, Space, Tree, message } from "antd";
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

function descendantIds(items: OrgUnit[], id?: string) {
  if (!id) return new Set<string>();
  const children = new Map<string, string[]>();
  items.forEach((item) => {
    if (!item.parentId) return;
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id]);
  });
  const result = new Set<string>();
  const walk = (current: string) => {
    for (const child of children.get(current) ?? []) {
      result.add(child);
      walk(child);
    }
  };
  walk(id);
  return result;
}

const newOrgUnitValues: Partial<OrgUnit> = {
  code: "",
  name: "",
  parentId: undefined,
  legalEntityId: undefined,
  type: "department",
  managerName: "",
  status: "active",
};

export function OrgUnitsPage() {
  const [items, setItems] = useState<OrgUnit[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [editing, setEditing] = useState<Partial<OrgUnit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const treeData = useMemo(() => toTree(items), [items]);
  const blockedParentIds = useMemo(() => {
    const ids = descendantIds(items, editing?.id);
    if (editing?.id) ids.add(editing.id);
    return ids;
  }, [items, editing?.id]);
  const parentOptions = useMemo(
    () => items
      .filter((item) => !blockedParentIds.has(item.id))
      .map((item) => ({ value: item.id, label: item.name })),
    [items, blockedParentIds],
  );

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

  useEffect(() => {
    form.resetFields();
    if (editing) {
      form.setFieldsValue({ ...newOrgUnitValues, ...editing });
    }
  }, [editing, form]);

  const openEditor = (item?: OrgUnit) => {
    setEditing(item ? { ...newOrgUnitValues, ...item } : { ...newOrgUnitValues });
  };

  const closeEditor = () => {
    setEditing(null);
  };

  const deleteOrgUnit = async (item: OrgUnit) => {
    setSaving(true);
    setError("");
    try {
      await api.deleteOrgUnit(item.id);
      if (editing?.id === item.id) {
        setEditing(null);
      }
      message.success("组织单元已删除");
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "组织单元删除失败"));
      message.error(getErrorMessage(err, "组织单元删除失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="org-units-page" data-vc-page="org-units">
      <PageTitle title="组织 scope 图谱" description="维护部门、共享中心、分支和跨法人项目组；这些层级决定 RAG 可见性、Agent 授权和审计范围。" />
      <InlineError message={error} onRetry={reload} />
      <Space className="toolbar" data-vc-kind="org-units-toolbar">
        <Button data-vc-action="org_unit.create" type="primary" onClick={() => openEditor()}>新增组织单元</Button>
      </Space>
      {loading ? <PageLoading /> : (
        <div className="split-panel" data-vc-kind="org-units-workbench">
          <div className="tree-panel" data-vc-kind="org-unit-tree">
            {treeData.length ? <Tree treeData={treeData} defaultExpandAll /> : <EmptyBlock description="暂无组织单元" />}
          </div>
          <div className="detail-panel" data-vc-kind="org-unit-list">
            {items.length ? items.map((item) => (
              <div
                key={item.id}
                className="list-row"
                data-vc-kind="org-unit-row"
                data-vc-object-type="org_unit"
                data-vc-object-id={item.id}
                data-vc-label={item.name}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.code} · {item.type} · {legalEntities.find((entity) => entity.id === item.legalEntityId)?.name ?? "不绑定法人"}</span>
                </div>
                <Space>
                  <Button data-vc-action="org_unit.edit" onClick={() => openEditor(item)}>编辑</Button>
                  <Popconfirm
                    title="删除组织单元"
                    description="仅未被子组织、员工任职、角色 scope、RAG scope 或消息引用的组织单元可以删除。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: saving }}
                    onConfirm={() => deleteOrgUnit(item)}
                  >
                    <Button data-vc-action="org_unit.delete" danger>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
            )) : <EmptyBlock description="暂无组织单元" />}
          </div>
        </div>
      )}
      <Modal
        title={editing?.id ? "编辑组织单元" : "新增组织单元"}
        open={!!editing}
        onCancel={closeEditor}
        onOk={() => form.submit()}
        cancelText="关闭"
        okText="保存"
        confirmLoading={saving}
        forceRender
        footer={(_, { CancelBtn, OkBtn }) => (
          <Space className="modal-footer-actions">
            {editing?.id ? (
              <Popconfirm
                title="删除组织单元"
                description="系统会先检查引用；如已被员工、角色或 RAG 使用，请改为 inactive 或迁移引用。"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true, loading: saving }}
                onConfirm={() => editing?.id && deleteOrgUnit(editing as OrgUnit)}
              >
                <Button danger disabled={saving}>删除</Button>
              </Popconfirm>
            ) : null}
            <CancelBtn />
            <OkBtn />
          </Space>
        )}
        modalRender={(node) => (
          <div
            data-vc-kind="org-unit-editor"
            data-vc-object-type={editing?.id ? "org_unit" : undefined}
            data-vc-object-id={editing?.id}
            data-vc-label={editing?.name ?? "新增组织单元"}
          >
            {node}
          </div>
        )}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={newOrgUnitValues}
          key={editing?.id ?? "new"}
          data-vc-kind="org-unit-form"
          data-vc-object-type={editing?.id ? "org_unit" : undefined}
          data-vc-object-id={editing?.id}
          data-vc-label={editing?.name ?? "新增组织单元"}
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
              closeEditor();
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "组织单元保存失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input data-vc-field="org_unit.code" /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input data-vc-field="org_unit.name" /></Form.Item>
          <Form.Item name="parentId" label="上级组织"><Select data-vc-field="org_unit.parent" allowClear options={parentOptions} /></Form.Item>
          <Form.Item name="legalEntityId" label="所属法人"><Select data-vc-field="org_unit.legal_entity" allowClear options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="type" label="类型"><Select data-vc-field="org_unit.type" options={["department", "center", "branch", "project", "shared"].map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="managerName" label="负责人"><Input data-vc-field="org_unit.manager" /></Form.Item>
          <Form.Item name="status" label="状态"><Select data-vc-field="org_unit.status" options={[
            { value: "active", label: "active" },
            { value: "inactive", label: "inactive" },
            { value: "archived", label: "archived" },
          ]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
