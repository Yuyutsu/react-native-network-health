import { useEffect, useRef, useState, useCallback } from "react";
import {
  NetworkMonitor,
  MonitorState,
} from "../core/networkMonitor";
import type {
  NetworkHealth,
  NetworkHealthConfig,
  NetworkHealthEvent,
  NetworkEventHandler,
} from "../types/networkTypes";

/**
 * React hook that provides real-time network health information.
 *
 * @param config - Optional configuration to tune detection thresholds.
 * @returns A `NetworkHealth` object describing the current connectivity state.
 *
 * @example
 * ```tsx
 * const network = useNetworkHealth({ slowLatencyMs: 1000 });
 *
 * if (network.isSlow) {
 *   // degrade video quality
 * }
 * ```
 */
export function useNetworkHealth(config?: NetworkHealthConfig): NetworkHealth {
  const monitorRef = useRef<NetworkMonitor | null>(null);

  if (monitorRef.current === null) {
    monitorRef.current = new NetworkMonitor(config);
  }

  const [monitorState, setMonitorState] = useState<MonitorState>(() =>
    monitorRef.current!.getState()
  );

  useEffect(() => {
    const monitor = monitorRef.current!;
    monitor.start();
    const unsubscribe = monitor.subscribe((state) => {
      setMonitorState(state);
    });

    return () => {
      unsubscribe();
      monitor.dispose();
      monitorRef.current = null;
    };
    // Config is read once at mount — monitor instance owns the config lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const on = useCallback(
    (event: NetworkHealthEvent, handler: NetworkEventHandler): (() => void) => {
      if (monitorRef.current === null) {
        return () => undefined;
      }
      return monitorRef.current.on(event, handler);
    },
    []
  );

  return {
    status: monitorState.status,
    isOnline: monitorState.isOnline,
    isSlow: monitorState.isSlow,
    isUnstable: monitorState.isUnstable,
    connectionType: monitorState.connectionType,
    latency: monitorState.latency,
    on,
  };
}
