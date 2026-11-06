import { useId, type ReactNode } from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

// A linha inteira e o botao (alvo >= 44px); o desenho 36x20 e o do mock.
export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      disabled={disabled}
      className="switch-row"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="switch-row__text">
        <span id={`${id}-label`}>{label}</span>
        {description && (
          <span id={`${id}-description`} className="switch-row__description">
            {description}
          </span>
        )}
      </span>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </button>
  );
}
