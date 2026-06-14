export default function LoadErrorState({
  message,
  onRetry,
  fullScreen = true,
  retryLabel = 'Спробувати ще раз',
  tone = 'danger',
}) {
  const palette = tone === 'warning'
    ? {
        background: 'rgba(255,181,71,0.08)',
        border: '1px solid rgba(255,181,71,0.22)',
        color: 'var(--warning)',
      }
    : {
        background: 'rgba(255,90,95,0.1)',
        border: '1px solid rgba(255,90,95,0.25)',
        color: 'var(--danger)',
      }

  const content = (
    <div style={{
      background: palette.background,
      border: palette.border,
      borderRadius: 16,
      padding: '14px 16px',
      color: palette.color,
      fontSize: 14,
      lineHeight: 1.5,
    }}>
      <div>{message}</div>
      {onRetry && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRetry}
          style={{ marginTop: 12 }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )

  if (!fullScreen) return content

  return (
    <div className="page page-top stack">
      {content}
    </div>
  )
}
