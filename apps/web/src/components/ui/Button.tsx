import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cx } from "../../lib/cx";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

function buttonClass({ variant = "primary", size = "md", block }: ButtonStyleProps, icon: boolean, extra?: string) {
  return cx("btn", `btn--${variant}`, `btn--${size}`, icon && "btn--icon", block && "btn--block", extra);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading = false, type = "button", className, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, block }, false, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label" | "loading" | "block"> {
  "aria-label": string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", size, type = "button", className, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass({ variant, size }, true, className)} {...rest}>
      {children}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, ButtonStyleProps {}

export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, block }, false, className)} {...rest} />;
}
