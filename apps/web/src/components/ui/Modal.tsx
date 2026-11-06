import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../../hooks/useDialogFocus";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, ...rest }: ModalProps) {
  if (!open) return null;
  return createPortal(<ModalContent {...rest} />, document.body);
}

function ModalContent({ onClose, title, description, children, footer }: Omit<ModalProps, "open">) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useDialogFocus(ref, true, onClose);

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        tabIndex={-1}
        className="modal"
      >
        <div className="modal__header">
          <h2 id={`${id}-title`} className="modal__title">
            {title}
          </h2>
          {description && (
            <p id={`${id}-description`} className="modal__description">
              {description}
            </p>
          )}
        </div>
        {children}
        {footer && <div className="modal__footer">{footer}</div>}
        <button type="button" className="modal__close" aria-label="Fechar" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
