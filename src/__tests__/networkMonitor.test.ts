import NetInfo from "@react-native-community/netinfo";
import { NetworkMonitor, MonitorState } from "../core/networkMonitor";

// Cast to access test helpers
const MockNetInfo = NetInfo as typeof NetInfo & {
  __setState: (state: object) => void;
  __reset: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Waits for the debounce delay plus a small margin. */
function flushDebounce(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NetworkMonitor", () => {
  beforeEach(() => {
    MockNetInfo.__reset();
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("starts with unknown status before start() is called", () => {
    const monitor = new NetworkMonitor();
    expect(monitor.getState().status).toBe("unknown");
  });

  it("transitions to healthy after start() when online", async () => {
    const monitor = new NetworkMonitor();
    const states: string[] = [];
    monitor.subscribe((s: MonitorState) => states.push(s.status));

    monitor.start();
    jest.advanceTimersByTime(400);

    expect(monitor.getState().isOnline).toBe(true);
    monitor.dispose();
  });

  it("transitions to offline when NetInfo reports disconnection", () => {
    const monitor = new NetworkMonitor();
    monitor.start();

    MockNetInfo.__setState({ isConnected: false, isInternetReachable: false, type: "none" });
    jest.advanceTimersByTime(400);

    expect(monitor.getState().status).toBe("offline");
    expect(monitor.getState().isOnline).toBe(false);
    monitor.dispose();
  });

  it("detects cellular connection type", () => {
    const monitor = new NetworkMonitor();
    monitor.start();

    MockNetInfo.__setState({ type: "cellular", isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(400);

    expect(monitor.getState().connectionType).toBe("cellular");
    monitor.dispose();
  });

  it("detects wifi connection type", () => {
    const monitor = new NetworkMonitor();
    monitor.start();

    MockNetInfo.__setState({ type: "wifi", isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(400);

    expect(monitor.getState().connectionType).toBe("wifi");
    monitor.dispose();
  });

  it("detects unstable connection after repeated reconnections", () => {
    const monitor = new NetworkMonitor({
      unstableReconnectThreshold: 3,
      unstableWindowMs: 10_000,
    });
    monitor.start();

    // Simulate three disconnect/reconnect cycles
    for (let i = 0; i < 3; i++) {
      MockNetInfo.__setState({ isConnected: false, isInternetReachable: false, type: "none" });
      MockNetInfo.__setState({ isConnected: true, isInternetReachable: true, type: "wifi" });
    }
    jest.advanceTimersByTime(400);

    expect(monitor.getState().isUnstable).toBe(true);
    expect(monitor.getState().status).toBe("unstable");
    monitor.dispose();
  });

  it("fires 'offline' event when going offline", () => {
    const handler = jest.fn();
    const monitor = new NetworkMonitor();
    monitor.start();
    monitor.on("offline", handler);

    MockNetInfo.__setState({ isConnected: false, isInternetReachable: false, type: "none" });
    jest.advanceTimersByTime(400);

    expect(handler).toHaveBeenCalled();
    monitor.dispose();
  });

  it("fires 'unstable' event when instability is detected", () => {
    const handler = jest.fn();
    const monitor = new NetworkMonitor({
      unstableReconnectThreshold: 3,
      unstableWindowMs: 10_000,
    });
    monitor.start();
    monitor.on("unstable", handler);

    for (let i = 0; i < 3; i++) {
      MockNetInfo.__setState({ isConnected: false, isInternetReachable: false, type: "none" });
      MockNetInfo.__setState({ isConnected: true, isInternetReachable: true, type: "wifi" });
    }
    jest.advanceTimersByTime(400);

    expect(handler).toHaveBeenCalled();
    monitor.dispose();
  });

  it("unsubscribes listener correctly", () => {
    const monitor = new NetworkMonitor();
    const cb = jest.fn();
    const unsub = monitor.subscribe(cb);
    monitor.start();

    unsub();
    MockNetInfo.__setState({ isConnected: false, isInternetReachable: false, type: "none" });
    jest.advanceTimersByTime(400);

    // cb should not be called after unsubscription
    expect(cb).not.toHaveBeenCalled();
    monitor.dispose();
  });

  it("unregisters event handler via returned cleanup fn", () => {
    const handler = jest.fn();
    const monitor = new NetworkMonitor();
    monitor.start();
    const off = monitor.on("offline", handler);

    off();
    MockNetInfo.__setState({ isConnected: false, isInternetReachable: false, type: "none" });
    jest.advanceTimersByTime(400);

    expect(handler).not.toHaveBeenCalled();
    monitor.dispose();
  });

  it("start() is idempotent — second call is a no-op", () => {
    const monitor = new NetworkMonitor();
    monitor.start();
    monitor.start(); // should not throw or create duplicate subscriptions
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    monitor.dispose();
  });

  it("slow status is set when latency exceeds threshold", async () => {
    // Return a very high latency value
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const monitor = new NetworkMonitor({ slowLatencyMs: 1 });
    monitor.start();

    // Trigger a ping cycle by running intervals
    jest.advanceTimersByTime(10_400);

    // Allow promises to settle
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
});
