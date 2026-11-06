import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Brand } from "../components/shell/Brand";
import { BrandingProvider, DEFAULT_BRANDING, parseColorPreset } from "./BrandingContext";

afterEach(() => {
  document.documentElement.removeAttribute("data-brand");
});

describe("BrandingContext", () => {
  it("falls back to verde for an invalid preset", () => {
    expect(parseColorPreset("roxo")).toBe("verde");
    expect(parseColorPreset(undefined)).toBe("verde");
    expect(parseColorPreset("vinho")).toBe("vinho");
    render(
      <BrandingProvider branding={{ colorPreset: "roxo" as never }}>
        <span />
      </BrandingProvider>,
    );
    expect(document.documentElement).not.toHaveAttribute("data-brand");
  });

  it("applies data-brand for non-default presets and removes it on unmount", () => {
    const { unmount } = render(
      <BrandingProvider branding={{ colorPreset: "azul" }}>
        <span />
      </BrandingProvider>,
    );
    expect(document.documentElement).toHaveAttribute("data-brand", "azul");
    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-brand");
  });

  it("shows the initial of the portal name when there is no logo", () => {
    render(
      <BrandingProvider branding={{ portalName: "zeta", legalName: "Condomínio Zeta" }}>
        <Brand />
      </BrandingProvider>,
    );
    expect(screen.getByText("Z")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Condomínio Zeta")).toBeInTheDocument();
  });

  it("shows the logo image when there is one", () => {
    render(
      <BrandingProvider branding={{ portalName: "Zeta", logoUrl: "https://exemplo.test/logo.png" }}>
        <Brand />
      </BrandingProvider>,
    );
    expect(screen.getByRole("img", { name: "Logotipo Zeta" })).toBeInTheDocument();
  });

  it("uses neutral defaults and the legal name when the portal name is empty", () => {
    expect(DEFAULT_BRANDING.portalName).toBe("Portal");
    render(
      <BrandingProvider branding={{ portalName: "  ", legalName: "Residencial Alfa" }}>
        <Brand />
      </BrandingProvider>,
    );
    expect(screen.getAllByText("Residencial Alfa").length).toBeGreaterThan(0);
  });
});
