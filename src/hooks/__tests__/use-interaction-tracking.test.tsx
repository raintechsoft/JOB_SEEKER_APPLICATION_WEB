import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInteractionTracking, type TrackedItem } from "@/hooks/use-interaction-tracking";
import { collectPendingDwell, setInteractionSink, type InteractionInput } from "@/lib/interactions/tracker";

const POST: TrackedItem = { kind: "post", id: "00000000-0000-4000-8000-000000000001" };
let observers: { callback: IntersectionObserverCallback }[] = [];
class FakeObserver {
  constructor(public callback: IntersectionObserverCallback) { observers.push(this); }
  observe() {}
  disconnect() { observers = observers.filter((o) => o !== this); }
}
const show = (ratio: number) => act(() => { for (const o of observers) o.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], o as unknown as IntersectionObserver); });
const tab = (state: "visible" | "hidden") => act(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: state }); document.dispatchEvent(new Event("visibilitychange")); });

function Card({ item }: { item: TrackedItem }) {
  const { ref, click } = useInteractionTracking<HTMLElement>(item, { surface: "feed", position: 2 });
  return <article ref={ref}><button onClick={click}>Open</button></article>;
}

describe("useInteractionTracking", () => {
  let recorded: InteractionInput[];
  beforeEach(() => {
    vi.useFakeTimers();
    observers = [];
    recorded = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    setInteractionSink({ record: (input) => recorded.push(input) });
  });
  afterEach(() => {
    setInteractionSink(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("reports a view once and the time spent when the card leaves view", () => {
    render(<Card item={POST} />);
    show(0.3);
    expect(recorded).toEqual([]);
    show(0.6);
    show(0.9);
    act(() => vi.advanceTimersByTime(3000));
    show(0);
    expect(recorded).toEqual([
      { action: "view", itemKind: "post", itemId: POST.id, surface: "feed", position: 2 },
      { action: "dwell", itemKind: "post", itemId: POST.id, surface: "feed", position: 2, dwellMs: 3000 },
    ]);
  });

  it("ignores a glance shorter than a second", () => {
    render(<Card item={POST} />);
    show(1);
    act(() => vi.advanceTimersByTime(600));
    show(0);
    expect(recorded.map((r) => r.action)).toEqual(["view"]);
  });

  it("does not count time while the tab is in the background", () => {
    render(<Card item={POST} />);
    show(1);
    act(() => vi.advanceTimersByTime(2000));
    tab("hidden");
    act(() => vi.advanceTimersByTime(60_000));
    tab("visible");
    act(() => vi.advanceTimersByTime(1500));
    show(0);
    expect(recorded.at(-1)).toMatchObject({ action: "dwell", dwellMs: 3500 });
  });

  it("reports open time when the page is left, then keeps measuring if the user returns", () => {
    render(<Card item={POST} />);
    show(1);
    act(() => vi.advanceTimersByTime(4000));
    act(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); collectPendingDwell(); });
    expect(recorded.at(-1)).toMatchObject({ action: "dwell", dwellMs: 4000 });
    tab("visible");
    act(() => vi.advanceTimersByTime(2000));
    show(0);
    expect(recorded.at(-1)).toMatchObject({ action: "dwell", dwellMs: 2000 });
  });

  it("reports when the card unmounts and never measures people or organizations", () => {
    const { unmount } = render(<Card item={POST} />);
    show(1);
    act(() => vi.advanceTimersByTime(2500));
    unmount();
    expect(recorded.at(-1)).toMatchObject({ action: "dwell", dwellMs: 2500 });

    recorded = [];
    render(<Card item={{ kind: "organization", id: "00000000-0000-4000-8000-000000000002" }} />);
    show(1);
    act(() => vi.advanceTimersByTime(5000));
    show(0);
    expect(recorded.map((r) => r.action)).toEqual(["view"]);
  });

  it("records clicks with the card's context", () => {
    const { getByRole } = render(<Card item={POST} />);
    act(() => getByRole("button").click());
    expect(recorded).toEqual([{ action: "click", itemKind: "post", itemId: POST.id, surface: "feed", position: 2 }]);
  });
});
