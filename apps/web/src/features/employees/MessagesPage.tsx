import { Button, Form, Input, Modal, Space, Table, Tag, Typography } from "antd";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
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
    <>
      <PageTitle title="消息社区" description="发布公告、内部交流和评论。" />
      <InlineError message={error} onRetry={() => reload()} />
      <Space className="toolbar">
        <Button type="primary" onClick={() => setPosting(true)}>发帖</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={{ total, current: page, onChange: reload, pageSize: 10 }}
        locale={{ emptyText: <EmptyBlock description="暂无消息" /> }}
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
          { title: "操作", render: (_, row) => <Button type="link" onClick={() => openComments(row)}>查看评论</Button> },
        ]}
      />
      <Modal title="发帖" open={posting} onCancel={() => setPosting(false)} onOk={() => form.submit()} confirmLoading={saving}>
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
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类" initialValue="general"><Input /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={selected?.title} open={!!selected} onCancel={() => setSelected(null)} footer={null}>
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
          <Form.Item name="content" rules={[{ required: true }]} style={{ flex: 1 }}><Input placeholder="写评论" /></Form.Item>
          <Button htmlType="submit" type="primary" loading={commenting}>发送</Button>
        </Form>
      </Modal>
    </>
  );
}
