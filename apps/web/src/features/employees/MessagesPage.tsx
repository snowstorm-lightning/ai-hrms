import { Button, Form, Input, Modal, Space, Table, Tag, Typography } from "antd";
import DOMPurify from "dompurify";
import { useEffect, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { CommentItem, MessageItem } from "../../api/types";
import { EmptyBlock, InlineError, PageLoading } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function MessagesPage() {
  const [items, setItems] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const [selected, setSelected] = useState<MessageItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [form] = Form.useForm();
  const [commentForm] = Form.useForm();

  const reload = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.messages(nextPage, 10);
      setItems(result.rows ?? []);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(getErrorMessage(err, "消息加载失败"));
    } finally {
      setLoading(false);
    }
  };

  const openComments = async (item: MessageItem) => {
    setSelected(item);
    setComments([]);
    setCommentError("");
    setCommentsLoading(true);
    try {
      setComments(await api.comments(item.id));
    } catch (err) {
      setCommentError(getErrorMessage(err, "评论加载失败"));
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => { void reload(1); }, []);

  return (
    <main data-vc-page="message-evidence" data-vc-kind="messages-page">
      <PageTitle title="消息与协作证据" description="发布公告、内部交流和评论；可作为组织沟通上下文进入审计和知识治理，而不是无边界训练数据。" />
      <InlineError message={error} onRetry={() => reload()} />
      <Space className="toolbar">
        <Button type="primary" data-vc-action="message.create" onClick={() => setPosting(true)}>发帖</Button>
      </Space>
      <Table
        data-vc-kind="message-table"
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={{ total, current: page, onChange: reload, pageSize: 10 }}
        locale={{ emptyText: <EmptyBlock description="暂无消息" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "message",
          "data-vc-object-id": row.id,
          "data-vc-label": row.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          {
            title: "标题",
            dataIndex: "title",
            render: (_, row) => (
              <div className="message-title-cell">
                <Space><Typography.Text strong>{row.title}</Typography.Text><Tag>{row.category}</Tag></Space>
                <Typography.Text type="secondary">{row.author || "匿名"} · 浏览 {row.view}</Typography.Text>
              </div>
            ),
          },
          {
            title: "内容",
            dataIndex: "content",
            render: (value) => <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }} />,
          },
          { title: "操作", render: (_, row) => <Button type="link" data-vc-action="message.comments.open" onClick={() => openComments(row)}>查看评论</Button> },
        ]}
      />
      <Modal title="发帖" open={posting} onCancel={() => setPosting(false)} onOk={() => form.submit()} confirmLoading={saving} data-vc-kind="message-editor">
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSaving(true);
            setError("");
            try {
              await api.createMessage(values);
              setPosting(false);
              form.resetFields();
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "消息保存失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input data-vc-field="message.title" /></Form.Item>
          <Form.Item name="category" label="分类" initialValue="general"><Input data-vc-field="message.category" /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea data-vc-field="message.content" rows={6} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={selected?.title} open={!!selected} onCancel={() => setSelected(null)} footer={null} data-vc-kind="message-comments" data-vc-object-type={selected ? "message" : undefined} data-vc-object-id={selected?.id} data-vc-label={selected?.title}>
        <InlineError message={commentError} onRetry={() => { if (selected) void openComments(selected); }} />
        <div className="comment-list">
          {commentsLoading ? <PageLoading /> : null}
          {!commentsLoading && comments.length === 0 ? <EmptyBlock description="暂无评论" /> : null}
          {!commentsLoading ? comments.map((item) => (
            <div className="comment-row" key={item.id}>
              <strong>{item.username || "匿名"}：</strong>
              <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.content) }} />
            </div>
          )) : null}
        </div>
        <Form
          form={commentForm}
          layout="inline"
          onFinish={async (values) => {
            if (!selected) return;
            setCommenting(true);
            setCommentError("");
            try {
              await api.createComment(selected.id, values.content);
              commentForm.resetFields();
              setComments(await api.comments(selected.id));
            } catch (err) {
              setCommentError(getErrorMessage(err, "评论发送失败"));
            } finally {
              setCommenting(false);
            }
          }}
        >
          <Form.Item name="content" rules={[{ required: true }]} style={{ flex: 1 }}><Input data-vc-field="comment.content" placeholder="写评论" /></Form.Item>
          <Button htmlType="submit" type="primary" data-vc-action="comment.create" loading={commenting}>发送</Button>
        </Form>
      </Modal>
    </main>
  );
}
