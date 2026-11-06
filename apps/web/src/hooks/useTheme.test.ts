import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandingProvider, type ThemePreference } from "../contexts/BrandingContext";
import { useTheme } from "./useTheme";

function wrapperFor(defaultTheme: ThemePreference) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(BrandingProvider, { branding: { defaultTheme }, children });
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTheme", () => {
  it("uses the condominium default when the user has no preference", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor("dark") });
    expect(result.current.preference).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("lets the user preference win over the condominium default", () => {
    localStorage.setItem("theme", "light");
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor("dark") });
    expect(result.current.preference).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("removes data-theme for system and persists the choice", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor("dark") });
    act(() => result.current.setPreference("system"));
    expect(result.current.preference).toBe("system");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("theme")).toBe("system");
  });

  it("ignores an invalid stored value", () => {
    localStorage.setItem("theme", "roxo");
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor("light") });
    expect(result.current.preference).toBe("light");
  });

  it("survives an unavailable localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor("light") });
    expect(result.current.preference).toBe("light");
    act(() => result.current.setPreference("dark"));
    expect(result.current.preference).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
