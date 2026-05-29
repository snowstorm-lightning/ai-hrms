import { Alert, Button, Empty } from "antd";
import type { ReactNode } from "react";

export function PageLoading({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={fullPage ? "centered" : "page-state"}>
      <span className="loading-spinner" aria-label="加载中" />
    </div>
  );
}

export function InlineError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  if (!message) {
    return null;
  }

  return (
    <Alert
      className="inline-error"
      type="error"
      showIcon
      title={message}
      action={
        onRetry ? (
          <Button size="small" danger onClick={onRetry}>
            重试
          </Button>
        ) : null
      }
    />
  );
}

export function EmptyBlock({ description = "暂无数据" }: { description?: ReactNode }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />;
}
