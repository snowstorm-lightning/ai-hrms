import { Button, Form, Input, Modal, Select, Space, Switch, Table, Tag } from "antd";
import { useEffect, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { LegalEntity, OrgUnit, Role, RoleBinding, User } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

type UserEditor = Partial<User> & { password?: string };

const newUserValues: UserEditor = {
  username: "",
  mobile: "",
  password: "",
  enableState: 1,
};

export function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserEditor | null>(null);
  const [roleEditing, setRoleEditing] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const [roleForm] = Form.useForm();

  const reload = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.users(nextPage, 10);
      setItems(result.rows ?? []);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(getErrorMessage(err, "用户列表加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(1); }, []);

  useEffect(() => {
    form.resetFields();
    if (editing) {
      form.setFieldsValue({ ...newUserValues, ...editing });
    }
  }, [editing, form]);

  const openEditor = (user?: User) => {
    setEditing(user ? { ...newUserValues, password: undefined, ...user } : { ...newUserValues });
  };

  const closeEditor = () => {
    setEditing(null);
  };

  const openRoleEditor = async (user: User) => {
    setRoleEditing(user);
    setRoleLoading(true);
    setError("");
    try {
      const [nextRoles, entities, units, bindings] = await Promise.all([
        api.roles(),
        api.legalEntities(),
        api.orgUnits(),
        api.userRoleBindings(user.id),
      ]);
      setRoles(nextRoles);
      setLegalEntities(entities);
      setOrgUnits(units);
      roleForm.setFieldsValue({ bindings });
    } catch (err) {
      setError(getErrorMessage(err, "角色绑定加载失败"));
      setRoleEditing(null);
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <main data-vc-page="accounts-and-roles" data-vc-kind="accounts-role-page">
      <PageTitle title="账号与角色治理" description="维护登录账号、角色绑定和 scope，是 Agent tool preview、RAG 检索和审计授权的权限底座。" />
      <InlineError message={error} onRetry={() => reload()} />
      <Space className="toolbar">
        <Button type="primary" data-vc-action="user.create" onClick={() => openEditor()}>新增用户</Button>
      </Space>
      <div className="hr-mobile-record-list" data-vc-kind="user-mobile-list">
        {loading ? <div className="hr-mobile-record-card">加载中...</div> : null}
        {!loading && !items.length ? <EmptyBlock description="暂无用户" /> : null}
        {items.map((row) => (
          <article className="hr-mobile-record-card" key={row.id} data-vc-kind="user-mobile-card" data-vc-object-type="user" data-vc-object-id={row.id} data-vc-label={row.username}>
            <span className="hr-mobile-card-title">{row.username}</span>
            <span className="hr-mobile-card-meta">{row.mobile || "未填写手机号"}</span>
            <span className="hr-mobile-card-tags">
              {(row.roles ?? []).map((role) => <Tag key={role}>{role}</Tag>)}
              <Tag color={row.enableState === 1 ? "green" : "red"}>{row.enableState === 1 ? "启用" : "禁用"}</Tag>
            </span>
            <Space wrap>
              <Button size="small" data-vc-action="user.edit" onClick={() => openEditor(row)}>编辑</Button>
              <Button size="small" data-vc-action="user.role_bindings.edit" onClick={() => openRoleEditor(row)}>权限</Button>
            </Space>
          </article>
        ))}
      </div>
      <Table
        className="hr-desktop-record-table"
        data-vc-kind="user-table"
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={{ total, current: page, onChange: reload, pageSize: 10 }}
        locale={{ emptyText: <EmptyBlock description="暂无用户" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "user",
          "data-vc-object-id": row.id,
          "data-vc-label": row.username,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "用户名", dataIndex: "username" },
          { title: "手机号", dataIndex: "mobile" },
          { title: "角色", dataIndex: "roles", render: (roles?: string[]) => roles?.map((role) => <Tag key={role}>{role}</Tag>) },
          { title: "启用", dataIndex: "enableState", render: (value) => <Tag color={value === 1 ? "green" : "red"}>{value === 1 ? "启用" : "禁用"}</Tag> },
          {
            title: "操作",
            render: (_, record) => (
              <Space>
                <Button data-vc-action="user.edit" onClick={() => openEditor(record)}>编辑</Button>
                <Button data-vc-action="user.role_bindings.edit" onClick={() => openRoleEditor(record)}>权限</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editing?.id ? "编辑用户" : "新增用户"} open={!!editing} onCancel={closeEditor} onOk={() => form.submit()} confirmLoading={saving} forceRender data-vc-kind="user-editor" data-vc-object-type={editing?.id ? "user" : undefined} data-vc-object-id={editing?.id} data-vc-label={editing?.username}>
        <Form
          form={form}
          layout="vertical"
          initialValues={newUserValues}
          key={editing?.id ?? "new"}
          onFinish={async (values) => {
            setSaving(true);
            setError("");
            try {
              if (editing?.id) {
                await api.updateUser(editing.id, values);
              } else {
                await api.createUser(values);
              }
              closeEditor();
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "用户保存失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input data-vc-field="user.username" /></Form.Item>
          <Form.Item name="mobile" label="手机号" rules={[{ required: true }]}><Input data-vc-field="user.mobile" disabled={!!editing?.id} /></Form.Item>
          {!editing?.id ? <Form.Item name="password" label="初始密码"><Input.Password data-vc-field="user.initial_password" placeholder="默认 password" /></Form.Item> : null}
          <Form.Item name="enableState" label="启用" valuePropName="checked" getValueProps={(value) => ({ checked: value === 1 })} normalize={(value) => value ? 1 : 0}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`角色绑定：${roleEditing?.username ?? ""}`}
        open={!!roleEditing}
        onCancel={() => setRoleEditing(null)}
        onOk={() => roleForm.submit()}
        confirmLoading={roleLoading || roleSaving}
        width={860}
        data-vc-kind="role-binding-editor"
        data-vc-object-type={roleEditing ? "user" : undefined}
        data-vc-object-id={roleEditing?.id}
        data-vc-label={roleEditing?.username}
      >
        <Form
          form={roleForm}
          layout="vertical"
          initialValues={{ bindings: [] }}
          onFinish={async (values: { bindings?: RoleBinding[] }) => {
            if (!roleEditing) return;
            const bindings = (values.bindings ?? []).map((binding) => ({
              ...binding,
              scopeId: binding.scopeType === "global" ? null : binding.scopeId,
              includeDescendants: Boolean(binding.includeDescendants),
            }));
            setRoleSaving(true);
            setError("");
            try {
              await api.updateUserRoleBindings(roleEditing.id, bindings);
              setRoleEditing(null);
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "角色绑定保存失败"));
            } finally {
              setRoleSaving(false);
            }
          }}
        >
          <Form.List name="bindings">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <div className="binding-row" key={field.key}>
                    <Form.Item name={[field.name, "roleCode"]} label="角色" rules={[{ required: true }]}>
                      <Select options={roles.map((role) => ({ value: role.code, label: `${role.name} (${role.code})` }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, "scopeType"]} label="作用域" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: "global", label: "全集团" },
                          { value: "legal_entity", label: "法人实体" },
                          { value: "org_unit", label: "组织单元" },
                        ]}
                        onChange={() => roleForm.setFieldValue(["bindings", field.name, "scopeId"], null)}
                      />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {({ getFieldValue }) => {
                        const scopeType = getFieldValue(["bindings", field.name, "scopeType"]);
                        if (scopeType === "global") return null;
                        const options = scopeType === "legal_entity"
                          ? legalEntities.map((item) => ({ value: item.id, label: item.name }))
                          : orgUnits.map((item) => ({ value: item.id, label: item.name }));
                        return (
                          <Form.Item name={[field.name, "scopeId"]} label="范围" rules={[{ required: true }]}>
                            <Select showSearch optionFilterProp="label" options={options} />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                    <Form.Item name={[field.name, "includeDescendants"]} label="含下级" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)}>删除</Button>
                  </div>
                ))}
                <Button onClick={() => add({ roleCode: "employee", scopeType: "org_unit", includeDescendants: true })}>
                  新增角色绑定
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </main>
  );
}
