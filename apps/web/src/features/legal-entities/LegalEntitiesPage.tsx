import { Button, Form, Input, Modal, Space, Table, Tag } from "antd";
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
    <>
      <PageTitle title="法人实体" description="维护总公司和具有独立法人属性的子公司。" />
      <InlineError message={error} onRetry={reload} />
      <Space className="toolbar">
        <Button type="primary" onClick={() => setEditing({ status: "active" })}>新增法人实体</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: <EmptyBlock description="暂无法人实体" /> }}
        columns={[
          { title: "编码", dataIndex: "code" },
          { title: "名称", dataIndex: "name" },
          { title: "法人名称", dataIndex: "legalName" },
          { title: "法人代表", dataIndex: "legalRepresentative" },
          { title: "地区", dataIndex: "area" },
          { title: "状态", dataIndex: "status", render: (status) => <Tag color="green">{status}</Tag> },
          { title: "操作", render: (_, record) => <Button onClick={() => setEditing(record)}>编辑</Button> },
        ]}
      />
      <Modal
        title={editing?.id ? "编辑法人实体" : "新增法人实体"}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing ?? {}}
          key={editing?.id ?? "new"}
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
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="legalName" label="法人名称"><Input /></Form.Item>
          <Form.Item name="unifiedSocialCreditCode" label="统一社会信用代码"><Input /></Form.Item>
          <Form.Item name="legalRepresentative" label="法人代表"><Input /></Form.Item>
          <Form.Item name="companyPhone" label="电话"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="area" label="地区"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
