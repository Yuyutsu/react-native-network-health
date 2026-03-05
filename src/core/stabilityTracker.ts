/**
 * Tracks connection events over a rolling time window to detect unstable
 * networks (frequent disconnect/reconnect cycles).
 */
export class StabilityTracker {
  private readonly threshold: number;
  private readonly windowMs: number;
  private readonly events: number[] = [];

  constructor(threshold: number = 3, windowMs: number = 10_000) {
    this.threshold = threshold;
    this.windowMs = windowMs;
  }

  /**
   * Records a connectivity-change event at the current timestamp.
   */
  recordEvent(): void {
    const now = Date.now();
    this.events.push(now);
    this.prune(now);
  }

  /**
   * Returns `true` when the number of connectivity-change events within the
   * rolling window meets or exceeds the instability threshold.
   */
  isUnstable(): boolean {
    this.prune(Date.now());
    return this.events.length >= this.threshold;
  }

  /**
   * Returns the count of connectivity-change events in the current window.
   */
  eventCount(): number {
    this.prune(Date.now());
    return this.events.length;
  }

  /** Resets all recorded events. */
  reset(): void {
    this.events.length = 0;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.events.length > 0 && (this.events[0] ?? 0) < cutoff) {
      this.events.shift();
    }
  }
}
