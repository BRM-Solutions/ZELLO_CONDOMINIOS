import type { ReactNode } from "react";

type AlertProps =
  | { tone: "danger"; children: ReactNode }
  | { tone: "warning"; icon?: ReactNode; action?: ReactNode; children: ReactNode };

export function Alert(props: AlertProps) {
  if (props.tone === "danger") {
    return (
      <div role="alert" className="alert--danger">
        {props.children}
      </div>
    );
  }
  return (
    <div className="alert--warning">
      {props.icon && (
        <span className="alert__icon" aria-hidden="true">
          {props.icon}
        </span>
      )}
      <div className="alert__body">{props.children}</div>
      {props.action && <div className="alert__action">{props.action}</div>}
    </div>
  );
}
