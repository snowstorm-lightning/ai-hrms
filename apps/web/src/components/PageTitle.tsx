import { Typography } from "antd";

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="page-title">
      <Typography.Title level={3}>{title}</Typography.Title>
      {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
    </div>
  );
}
