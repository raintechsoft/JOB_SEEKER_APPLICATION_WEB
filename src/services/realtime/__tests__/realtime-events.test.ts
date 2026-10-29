import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { REALTIME_INVALIDATIONS, emitRealtime, onRealtime, realtimeConnected, useRealtimeStatus } from "@/services/realtime/realtime-events";
import { useLiveInterval } from "@/features/messaging/realtime-bridge";

afterEach(() => useRealtimeStatus.getState().set(false));

describe("realtime signals replace polling", () => {
  it("polls at the base interval without a socket and not at all while connected", () => {
    const { result } = renderHook(() => useLiveInterval(10_000));
    expect(result.current).toBe(10_000);

    act(() => useRealtimeStatus.getState().set(true));
    expect(result.current).toBe(false);
    expect(realtimeConnected()).toBe(true);

    act(() => useRealtimeStatus.getState().set(false));
    expect(result.current).toBe(10_000);
  });

  it("refreshes every screen that used to poll for each server event", () => {
    expect(REALTIME_INVALIDATIONS["notification.updated"]).toEqual(expect.arrayContaining(["notification-counts", "notifications"]));
    expect(REALTIME_INVALIDATIONS["conversation.updated"]).toEqual(expect.arrayContaining(["messaging", "message-history", "messaging-unread"]));
    expect(REALTIME_INVALIDATIONS["application.updated"]).toEqual(expect.arrayContaining(["application", "applications", "responses"]));
    expect(REALTIME_INVALIDATIONS["export.updated"]).toEqual(["export-status"]);
    expect(Object.keys(REALTIME_INVALIDATIONS)).toContain("media.updated");
  });

  it("delivers raw signals to listeners until they unsubscribe", () => {
    const listener = vi.fn();
    const stop = onRealtime("media.updated", listener);

    emitRealtime("media.updated", { assetId: "a1", state: "accepted" });
    emitRealtime("export.updated", { exportId: "e1" });
    stop();
    emitRealtime("media.updated", { assetId: "a2" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ assetId: "a1", state: "accepted" });
  });
});
