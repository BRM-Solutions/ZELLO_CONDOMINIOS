import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BrandingProvider } from "../contexts/BrandingContext";
import DesignSystemPage from "./DesignSystemPage";

afterEach(() => {
  document.documentElement.removeAttribute("data-brand");
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <BrandingProvider>
        <DesignSystemPage />
      </BrandingProvider>
    </MemoryRouter>,
  );
}

describe("DesignSystemPage", () => {
  it("renders the showcase and previews color presets", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Design System" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Predefinição de cor"), { target: { value: "vinho" } });
    expect(document.documentElement).toHaveAttribute("data-brand", "vinho");
  });

  it("opens and closes the modal", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Abrir modal" }));
    expect(screen.getByRole("dialog", { name: "Nova ocorrência" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles the switch", () => {
    renderPage();
    const toggle = screen.getByRole("switch", { name: "Receber avisos por e-mail" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
