import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "./Button";

describe("Button", () => {
  it("disables and flags busy while loading", () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("is enabled and not busy by default, with type button", () => {
    render(<Button>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toHaveAttribute("type", "button");
  });

  it("maps variant and size to classes", () => {
    render(
      <>
        <Button>Padrão</Button>
        <Button variant="danger" size="lg">
          Excluir
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Padrão" })).toHaveClass("btn", "btn--primary", "btn--md");
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveClass("btn", "btn--danger", "btn--lg");
  });

  it("finds an icon button by its accessible name", () => {
    render(
      <IconButton aria-label="Adicionar">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Adicionar" })).toHaveClass("btn--icon", "btn--ghost");
  });
});
