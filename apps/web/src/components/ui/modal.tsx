"use client";

import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  backdropClassName?: string;
  cardClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  actionsClassName?: string;
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Modal({
  open,
  title,
  onClose,
  children,
  actions,
  backdropClassName,
  cardClassName,
  headerClassName,
  bodyClassName,
  actionsClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={cx("uiModalBackdrop", backdropClassName)} role="dialog" aria-modal="true" aria-label={title}>
      <div className={cx("uiModalCard", cardClassName)}>
        <div className={cx("uiModalHeader", headerClassName)}>
          <h3>{title}</h3>
          <button type="button" className="uiModalClose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={cx("uiModalBody", bodyClassName)}>{children}</div>
        {actions ? <div className={cx("uiModalActions", actionsClassName)}>{actions}</div> : null}
      </div>
    </div>
  );
}
