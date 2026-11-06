import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Modal } from "./Modal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Título" description="Descrição">
        <button type="button">Dentro</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("labels the dialog, closes with Esc and returns the focus", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Título" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Descrição");
    expect(screen.getByRole("button", { name: "Dentro" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps the focus inside while tabbing", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const inside = screen.getByRole("button", { name: "Dentro" });
    const close = screen.getByRole("button", { name: "Fechar" });
    close.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(inside).toHaveFocus();
  });
});
