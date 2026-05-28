// 위험한 일괄 작업 전에 한 번 더 확인받는 간단한 확인 팝업입니다.
export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="dialog-cancel" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="dialog-confirm" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
