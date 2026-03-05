import { StabilityTracker } from "../core/stabilityTracker";

describe("StabilityTracker", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is not unstable with fewer events than threshold", () => {
    const tracker = new StabilityTracker(3, 10_000);
    tracker.recordEvent();
    tracker.recordEvent();
    expect(tracker.isUnstable()).toBe(false);
  });

  it("becomes unstable when event count reaches threshold", () => {
    const tracker = new StabilityTracker(3, 10_000);
    tracker.recordEvent();
    tracker.recordEvent();
    tracker.recordEvent();
    expect(tracker.isUnstable()).toBe(true);
  });

  it("expires old events outside the window", () => {
    const tracker = new StabilityTracker(3, 5_000);
    tracker.recordEvent();
    tracker.recordEvent();
    tracker.recordEvent();
    expect(tracker.isUnstable()).toBe(true);

    // Advance past the window
    jest.advanceTimersByTime(6_000);

    expect(tracker.isUnstable()).toBe(false);
  });

  it("eventCount returns the number of events in the window", () => {
    const tracker = new StabilityTracker(3, 10_000);
    expect(tracker.eventCount()).toBe(0);

    tracker.recordEvent();
    tracker.recordEvent();
    expect(tracker.eventCount()).toBe(2);
  });

  it("reset clears all events", () => {
    const tracker = new StabilityTracker(3, 10_000);
    tracker.recordEvent();
    tracker.recordEvent();
    tracker.recordEvent();
    tracker.reset();
    expect(tracker.isUnstable()).toBe(false);
    expect(tracker.eventCount()).toBe(0);
  });

  it("detects instability over a sliding window with new events", () => {
    const tracker = new StabilityTracker(3, 5_000);

    tracker.recordEvent();
    tracker.recordEvent();
    jest.advanceTimersByTime(4_500);
    // Old events are still within the window
    tracker.recordEvent();
    expect(tracker.isUnstable()).toBe(true);

    // Advance past the old events
    jest.advanceTimersByTime(1_000);
    // Only the latest event is within the window now
    expect(tracker.isUnstable()).toBe(false);
  });
});
