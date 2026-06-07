import { Typography } from "antd";
import type { ReactNode } from "react";

export function PageTitle({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="page-title">
      {meta ? <div className="page-title-meta">{meta}</div> : null}
      <Typography.Title level={3}>{title}</Typography.Title>
      {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
    </div>
  );
}
