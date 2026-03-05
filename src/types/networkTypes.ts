export type NetworkStatus = "healthy" | "slow" | "unstable" | "offline" | "unknown";

export type ConnectionType = "wifi" | "cellular" | "unknown";

export type NetworkHealthEvent = "slow" | "unstable" | "offline" | "healthy";

export type NetworkEventHandler = () => void;

export type NetworkHealth = {
  status: NetworkStatus;
  isOnline: boolean;
  isSlow: boolean;
  isUnstable: boolean;
  connectionType: ConnectionType;
  latency?: number;
  on: (event: NetworkHealthEvent, handler: NetworkEventHandler) => () => void;
};

export type NetworkHealthConfig = {
  /**
   * Latency threshold in milliseconds above which the network is considered slow.
   * @default 1500
   */
  slowLatencyMs?: number;
  /**
   * Number of reconnections within the observation window that marks the
   * connection as unstable.
   * @default 3
   */
  unstableReconnectThreshold?: number;
  /**
   * URL used for latency ping checks (HEAD request).
   * @default "https://www.google.com"
   */
  pingUrl?: string;
  /**
   * Interval in milliseconds between automatic latency checks.
   * @default 10000
   */
  pingIntervalMs?: number;
  /**
   * Time window in milliseconds over which reconnections are counted to detect
   * instability.
   * @default 10000
   */
  unstableWindowMs?: number;
};
