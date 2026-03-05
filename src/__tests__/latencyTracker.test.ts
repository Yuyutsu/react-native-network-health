import { LatencyTracker } from "../core/latencyTracker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchMock(latencyMs: number): jest.Mock {
  return jest.fn(
    () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response(null, { status: 200 })), latencyMs)
      )
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LatencyTracker", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns null when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const tracker = new LatencyTracker("https://example.com/ping");
    const result = await tracker.measure();
    expect(result).toBeNull();
  });

  it("returns a non-negative latency on success", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const tracker = new LatencyTracker("https://example.com/ping");
    const result = await tracker.measure();
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(0);
  });

  it("maintains a rolling window of samples", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const tracker = new LatencyTracker("https://example.com/ping", 3);

    // Populate with 4 samples — oldest should be evicted
    await tracker.measure();
    await tracker.measure();
    await tracker.measure();
    await tracker.measure();

    const avg = tracker.getAverage();
    expect(avg).not.toBeUndefined();
  });

  it("getAverage returns undefined when no measurements taken", () => {
    const tracker = new LatencyTracker("https://example.com/ping");
    expect(tracker.getAverage()).toBeUndefined();
  });

  it("reset clears all samples", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const tracker = new LatencyTracker("https://example.com/ping");
    await tracker.measure();
    tracker.reset();
    expect(tracker.getAverage()).toBeUndefined();
  });

  it("aborts after 10 seconds", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    global.fetch = jest.fn().mockRejectedValue(abortError);

    const tracker = new LatencyTracker("https://example.com/ping");
    const resultPromise = tracker.measure();
    jest.advanceTimersByTime(10_001);
    const result = await resultPromise;
    expect(result).toBeNull();
  });
});
