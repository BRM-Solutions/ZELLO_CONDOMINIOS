import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card", className)} {...rest} />;
}

interface CardTitleProps {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}

export function CardTitle({ icon, title, action }: CardTitleProps) {
  return (
    <div className="card-title">
      <div className="card-title__main">
        {icon && (
          <span className="card-title__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <h3 className="card-title__text">{title}</h3>
      </div>
      {action}
    </div>
  );
}
