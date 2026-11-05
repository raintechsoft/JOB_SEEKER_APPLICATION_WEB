import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadResponseTableFullscreen,
  saveResponseTableFullscreen,
  serverResponseTableFullscreen,
  subscribeResponseTableFullscreen,
} from "../response-table-prefs";

afterEach(() => {
  window.localStorage.clear();
});

describe("response table full-screen store", () => {
  it("defaults to off, persists on, and notifies subscribers", () => {
    expect(loadResponseTableFullscreen()).toBe(false);
    expect(serverResponseTableFullscreen()).toBe(false);
    const listener = vi.fn();
    const unsubscribe = subscribeResponseTableFullscreen(listener);
    saveResponseTableFullscreen(true);
    expect(loadResponseTableFullscreen()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    saveResponseTableFullscreen(false);
    expect(loadResponseTableFullscreen()).toBe(false);
    expect(window.localStorage.getItem("job_application_responses:fullscreen:v1")).toBeNull();
    unsubscribe();
    saveResponseTableFullscreen(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reacts to cross-tab storage events for its key only", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeResponseTableFullscreen(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: "job_application_responses:fullscreen:v1" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
