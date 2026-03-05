import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from "@react-native-community/netinfo";
import type {
  ConnectionType,
  NetworkEventHandler,
  NetworkHealthConfig,
  NetworkHealthEvent,
  NetworkStatus,
} from "../types/networkTypes";
import { debounce } from "../utils/debounce";
import { LatencyTracker } from "./latencyTracker";
import { StabilityTracker } from "./stabilityTracker";

export type MonitorState = {
  status: NetworkStatus;
  isOnline: boolean;
  isSlow: boolean;
  isUnstable: boolean;
  connectionType: ConnectionType;
  latency: number | undefined;
};

const DEFAULT_CONFIG: Required<NetworkHealthConfig> = {
  slowLatencyMs: 1500,
  unstableReconnectThreshold: 3,
  pingUrl: "https://www.google.com",
  pingIntervalMs: 10_000,
  unstableWindowMs: 10_000,
};

type StateChangeCallback = (state: MonitorState) => void;

/**
 * Core network monitoring engine.  It wires together NetInfo, the
 * LatencyTracker, and the StabilityTracker to emit a unified MonitorState.
 *
 * Consumers subscribe via `subscribe()` and clean up via `dispose()`.
 */
export class NetworkMonitor {
  private readonly config: Required<NetworkHealthConfig>;
  private readonly latencyTracker: LatencyTracker;
  private readonly stabilityTracker: StabilityTracker;
  private readonly listeners: Set<StateChangeCallback> = new Set();
  private readonly eventListeners: Map<
    NetworkHealthEvent,
    Set<NetworkEventHandler>
  > = new Map();

  private netInfoUnsubscribe: NetInfoSubscription | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private state: MonitorState;
  private readonly debouncedEmit: (() => void) & { cancel: () => void };

  constructor(config: NetworkHealthConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.latencyTracker = new LatencyTracker(this.config.pingUrl);
    this.stabilityTracker = new StabilityTracker(
      this.config.unstableReconnectThreshold,
      this.config.unstableWindowMs
    );
    this.state = {
      status: "unknown",
      isOnline: false,
      isSlow: false,
      isUnstable: false,
      connectionType: "unknown",
      latency: undefined,
    };
    this.debouncedEmit = debounce(() => this.emit(), 300);
  }

  /** Start monitoring. Safe to call multiple times — idempotent. */
  start(): void {
    if (this.netInfoUnsubscribe !== null) {
      return;
    }

    this.netInfoUnsubscribe = NetInfo.addEventListener(
      (netState: NetInfoState) => {
        this.handleNetInfoChange(netState);
      }
    );

    this.pingTimer = setInterval(() => {
      void this.runPing();
    }, this.config.pingIntervalMs);
  }

  /** Stop monitoring and release all resources. */
  dispose(): void {
    if (this.netInfoUnsubscribe !== null) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.debouncedEmit.cancel();
    this.listeners.clear();
    this.eventListeners.clear();
    this.latencyTracker.reset();
    this.stabilityTracker.reset();
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Register a named event listener.
   * Returns an unsubscribe function.
   */
  on(event: NetworkHealthEvent, handler: NetworkEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  /** Returns a snapshot of the current state. */
  getState(): MonitorState {
    return { ...this.state };
  }

  private handleNetInfoChange(netState: NetInfoState): void {
    const isConnected =
      netState.isConnected === true && netState.isInternetReachable !== false;

    const connectionType = resolveConnectionType(netState.type);

    if (isConnected !== this.state.isOnline) {
      this.stabilityTracker.recordEvent();
    }

    const isUnstable = this.stabilityTracker.isUnstable();
    const isSlow = this.isSlow();
    const status = computeStatus(isConnected, isSlow, isUnstable);

    const prev = this.state;
    this.state = {
      status,
      isOnline: isConnected,
      isSlow,
      isUnstable,
      connectionType,
      latency: this.latencyTracker.getAverage(),
    };

    this.debouncedEmit();
    this.fireEvents(prev, this.state);
  }

  private async runPing(): Promise<void> {
    const latency = await this.latencyTracker.measure();
    const isSlow =
      latency === null ||
      latency > this.config.slowLatencyMs ||
      this.isSlow();

    const isUnstable = this.stabilityTracker.isUnstable();
    const status = computeStatus(this.state.isOnline, isSlow, isUnstable);

    const prev = this.state;
    this.state = {
      ...this.state,
      status,
      isSlow,
      isUnstable,
      latency: this.latencyTracker.getAverage(),
    };

    this.debouncedEmit();
    this.fireEvents(prev, this.state);
  }

  private isSlow(): boolean {
    const avg = this.latencyTracker.getAverage();
    if (avg === undefined) {
      return false;
    }
    return avg > this.config.slowLatencyMs;
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch {
        // Swallow listener errors — never crash the app.
      }
    });
  }

  private fireEvents(prev: MonitorState, next: MonitorState): void {
    if (!next.isOnline && prev.isOnline) {
      this.triggerEvent("offline");
    }
    if (next.isSlow && !prev.isSlow) {
      this.triggerEvent("slow");
    }
    if (next.isUnstable && !prev.isUnstable) {
      this.triggerEvent("unstable");
    }
    if (
      next.status === "healthy" &&
      (prev.status === "slow" ||
        prev.status === "unstable" ||
        prev.status === "offline")
    ) {
      this.triggerEvent("healthy");
    }
  }

  private triggerEvent(event: NetworkHealthEvent): void {
    this.eventListeners.get(event)?.forEach((handler) => {
      try {
        handler();
      } catch {
        // Swallow handler errors — never crash the app.
      }
    });
  }
}

function resolveConnectionType(type: string): ConnectionType {
  if (type === "wifi") {
    return "wifi";
  }
  if (type === "cellular") {
    return "cellular";
  }
  return "unknown";
}

function computeStatus(
  isOnline: boolean,
  isSlow: boolean,
  isUnstable: boolean
): NetworkStatus {
  if (!isOnline) {
    return "offline";
  }
  if (isUnstable) {
    return "unstable";
  }
  if (isSlow) {
    return "slow";
  }
  return "healthy";
}
