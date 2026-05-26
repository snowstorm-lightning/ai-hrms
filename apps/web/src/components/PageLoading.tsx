export function PageLoading({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={fullPage ? "centered" : "page-state"}>
      <span className="loading-spinner" aria-label="加载中" />
    </div>
  );
}
