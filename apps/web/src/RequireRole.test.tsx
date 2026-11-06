import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequireRole } from "./components/RequireRole";

const useAuthMock = vi.fn();

vi.mock("./contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }));

function renderGuard() {
  render(
    <RequireRole roles={["owner", "admin"]}>
      <p>conteúdo restrito</p>
    </RequireRole>,
  );
}

describe("RequireRole", () => {
  it("renders the content for an allowed role", () => {
    useAuthMock.mockReturnValue({ loading: false, role: "admin" });
    renderGuard();
    expect(screen.getByText("conteúdo restrito")).toBeInTheDocument();
  });

  it("blocks other roles and missing membership", () => {
    for (const role of ["member", undefined]) {
      useAuthMock.mockReturnValue({ loading: false, role });
      renderGuard();
      expect(screen.queryByText("conteúdo restrito")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });

  it("shows loading while the profile is pending", () => {
    useAuthMock.mockReturnValue({ loading: true, role: undefined });
    renderGuard();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
