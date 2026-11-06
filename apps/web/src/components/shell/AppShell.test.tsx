import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const useAuthMock = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }));

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="o/:organizationId/*" element={<p>conteúdo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    email: "ana.souza@exemplo.com",
    memberships: [{ id: "m1", organizationId: "org-1", workspaceId: null, role: "owner" }],
    organizationId: "org-1",
    role: "owner",
    signOut: vi.fn(),
  });
});

describe("AppShell", () => {
  it("opens the drawer and closes it with Esc", () => {
    renderShell("/o/org-1");
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("closes the drawer when the overlay is clicked", () => {
    const { container } = renderShell("/o/org-1");
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(toggle);
    fireEvent.click(container.querySelector(".drawer__overlay") as HTMLElement);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the current link with aria-current", () => {
    renderShell("/o/org-1");
    const [painel] = screen.getAllByRole("link", { name: "Painel Geral" });
    const [config] = screen.getAllByRole("link", { name: "Configurações" });
    expect(painel).toHaveAttribute("aria-current", "page");
    expect(config).not.toHaveAttribute("aria-current");
  });

  it("marks Configurações when on its route and hides it from members", () => {
    renderShell("/o/org-1/organizacao");
    const [config] = screen.getAllByRole("link", { name: "Configurações" });
    expect(config).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Painel Geral" })[0]).not.toHaveAttribute("aria-current");
  });

  it("does not list Configurações for member and skips the bottom nav", () => {
    useAuthMock.mockReturnValue({
      email: "membro@exemplo.com",
      memberships: [{ id: "m1", organizationId: "org-1", workspaceId: null, role: "member" }],
      organizationId: "org-1",
      role: "member",
      signOut: vi.fn(),
    });
    renderShell("/o/org-1");
    expect(screen.queryByRole("link", { name: "Configurações" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação rápida" })).not.toBeInTheDocument();
  });
});
