import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/** Re-imports the env module and DevOnly with `NEXT_PUBLIC_APP_ENV` set to `value`. */
async function load(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", value);
  const env = await import("@/lib/env/app-env");
  const { DevOnly } = await import("@/components/ui/dev-only");
  return { ...env, DevOnly };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("app environment", () => {
  it("shows development-only UI and copy in development", async () => {
    const { appEnv, devCopy, DevOnly } = await load("development");
    expect(appEnv).toBe("development");
    expect(devCopy("Apply in demo", "Apply")).toBe("Apply in demo");
    render(<DevOnly>Professional demo</DevOnly>);
    expect(screen.getByText("Professional demo")).toBeInTheDocument();
  });

  it.each(["production", "staging", undefined])("hides development-only UI when NEXT_PUBLIC_APP_ENV=%s", async (value) => {
    const { appEnv, devCopy, DevOnly } = await load(value);
    expect(appEnv).toBe("production");
    expect(devCopy("Apply in demo", "Apply")).toBe("Apply");
    const { container } = render(<DevOnly>Professional demo</DevOnly>);
    expect(container).toBeEmptyDOMElement();
  });
});
