"use client";

import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function Modal({ open, title, onClose, children, actions }: ModalProps) {
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
    <div className="uiModalBackdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="uiModalCard">
        <div className="uiModalHeader">
          <h3>{title}</h3>
          <button type="button" className="uiModalClose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="uiModalBody">{children}</div>
        {actions ? <div className="uiModalActions">{actions}</div> : null}
      </div>
    </div>
  );
}
