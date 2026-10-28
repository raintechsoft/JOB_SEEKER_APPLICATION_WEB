import { describe, expect, it, vi } from "vitest";
import { createHttpAuthService } from "@/services/auth/auth.http";
import type { HttpClient } from "@/services/api/client";

const session = { user: { id: "u1", name: "Skillora Admin", email: "admin@demo.skillora.test", email_verified: true }, workspaces: [], selected_identity_id: null, email_challenge: null };

describe("signing in from an admin page", () => {
  it("uses the plain login (no workspace needed); the portals keep their own endpoints", async () => {
    const post = vi.fn(async () => ({ data: session }));
    const http = { post, get: vi.fn(), setUserContext: vi.fn() } as unknown as HttpClient;
    const auth = createHttpAuthService(http);
    const input = { email: "admin@demo.skillora.test", password: "password" };

    await auth.login(input, "admin");
    expect(post).toHaveBeenLastCalledWith("auth/login", input);
    await auth.login(input, "employer");
    expect(post).toHaveBeenLastCalledWith("auth/employer/login", input);
    await auth.login(input);
    expect(post).toHaveBeenLastCalledWith("auth/professional/login", input);
  });
});
