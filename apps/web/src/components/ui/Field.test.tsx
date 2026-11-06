import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Input } from "./Field";

describe("Field", () => {
  it("links the error to the control", () => {
    render(
      <Field label="E-mail" error="Informe um e-mail válido">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("Informe um e-mail válido");
  });

  it("leaves the control clean without error", () => {
    render(
      <Field label="E-mail">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
