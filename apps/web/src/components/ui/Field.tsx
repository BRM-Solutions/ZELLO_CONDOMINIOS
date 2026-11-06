import {
  cloneElement,
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
} from "react";
import { cx } from "../../lib/cx";

interface ControlProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface FieldProps {
  label: string;
  error?: string;
  children: ReactElement<ControlProps>;
}

export function Field({ label, error, children }: FieldProps) {
  const base = useId();
  const controlId = children.props.id ?? `${base}-control`;
  const errorId = `${base}-error`;
  const control = cloneElement(children, {
    id: controlId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : children.props["aria-describedby"],
  });
  return (
    <div className="field">
      <label className="field__label" htmlFor={controlId}>
        {label}
      </label>
      {control}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx("input", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...rest },
  ref,
) {
  return <select ref={ref} className={cx("input", className)} {...rest} />;
});
