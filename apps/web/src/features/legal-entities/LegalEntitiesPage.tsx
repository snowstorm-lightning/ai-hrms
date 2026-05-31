import { Alert, Button, Form, Input, Modal, Space, Table, Tag } from "antd";
import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { LegalEntity } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function LegalEntitiesPage() {
  const [items, setItems] = useState<LegalEntity[]>([]);
  const [editing, setEditing] = useState<Partial<LegalEntity> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await api.legalEntities());
    } catch (err) {
      setError(getErrorMessage(err, "法人实体加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div className="legal-entities-page" data-vc-page="legal-entities">
      <PageTitle title="法人 scope 底座" description="维护总公司和具有独立法人属性的子公司；法人边界用于权限、资料范围、Agent 工具预览和审计责任归属。" />
      <Alert className="section-card" type="info" showIcon title="当前公司与法人字段为虚构样本数据，不代表腾讯或任何真实企业。" />
      <InlineError message={error} onRetry={reload} />
      <Space className="toolbar" data-vc-kind="legal-entities-toolbar">
        <Button data-vc-action="legal_entity.create" type="primary" onClick={() => setEditing({ status: "active" })}>新增法人实体</Button>
      </Space>
      <Table
        data-vc-kind="legal-entity-table"
        rowKey="id"
        loading={loading}
        dataSource={items}
        onRow={(row) => ({
          "data-vc-kind": "legal-entity-row",
          "data-vc-object-type": "legal_entity",
          "data-vc-object-id": row.id,
          "data-vc-label": row.name,
        } as HTMLAttributes<HTMLElement>)}
        locale={{ emptyText: <EmptyBlock description="暂无法人实体" /> }}
        columns={[
          { title: "编码", dataIndex: "code" },
          { title: "名称", dataIndex: "name" },
          { title: "法人名称", dataIndex: "legalName" },
          { title: "法人代表", dataIndex: "legalRepresentative" },
          { title: "地区", dataIndex: "area" },
          { title: "状态", dataIndex: "status", render: (status) => <Tag color="green">{status}</Tag> },
          { title: "操作", render: (_, record) => <Button data-vc-action="legal_entity.edit" onClick={() => setEditing(record)}>编辑</Button> },
        ]}
      />
      <Modal
        title={editing?.id ? "编辑法人实体" : "新增法人实体"}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        modalRender={(node) => (
          <div
            data-vc-kind="legal-entity-editor"
            data-vc-object-type={editing?.id ? "legal_entity" : undefined}
            data-vc-object-id={editing?.id}
            data-vc-label={editing?.name ?? "新增法人实体"}
          >
            {node}
          </div>
        )}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing ?? {}}
          key={editing?.id ?? "new"}
          data-vc-kind="legal-entity-form"
          data-vc-object-type={editing?.id ? "legal_entity" : undefined}
          data-vc-object-id={editing?.id}
          data-vc-label={editing?.name ?? "新增法人实体"}
          onFinish={async (values) => {
            setSaving(true);
            setError("");
            try {
              if (editing?.id) {
                await api.updateLegalEntity(editing.id, values);
              } else {
                await api.createLegalEntity(values);
              }
              setEditing(null);
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "法人实体保存失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input data-vc-field="legal_entity.code" /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input data-vc-field="legal_entity.name" /></Form.Item>
          <Form.Item name="legalName" label="法人名称"><Input data-vc-field="legal_entity.legal_name" /></Form.Item>
          <Form.Item name="unifiedSocialCreditCode" label="统一社会信用代码"><Input data-vc-field="legal_entity.credit_code" /></Form.Item>
          <Form.Item name="legalRepresentative" label="法人代表"><Input data-vc-field="legal_entity.representative" /></Form.Item>
          <Form.Item name="companyPhone" label="电话"><Input data-vc-field="legal_entity.phone" /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input data-vc-field="legal_entity.email" /></Form.Item>
          <Form.Item name="area" label="地区"><Input data-vc-field="legal_entity.area" /></Form.Item>
          <Form.Item name="address" label="地址"><Input data-vc-field="legal_entity.address" /></Form.Item>
          <Form.Item name="status" label="状态"><Input data-vc-field="legal_entity.status" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
