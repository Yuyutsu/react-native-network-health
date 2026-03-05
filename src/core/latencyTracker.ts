/**
 * Tracks latency by issuing lightweight HEAD requests and maintaining a
 * rolling average of recent measurements.
 */
export class LatencyTracker {
  private readonly pingUrl: string;
  private readonly windowSize: number;
  private readonly samples: number[] = [];

  constructor(pingUrl: string, windowSize: number = 5) {
    this.pingUrl = pingUrl;
    this.windowSize = windowSize;
  }

  /**
   * Issues a HEAD request to the configured ping URL and returns the round-trip
   * time in milliseconds, or `null` when the request fails (e.g. offline).
   */
  async measure(): Promise<number | null> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      await fetch(this.pingUrl, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      this.addSample(latency);
      return latency;
    } catch {
      return null;
    }
  }

  /**
   * Returns the rolling average of the last `windowSize` successful latency
   * measurements, or `undefined` when no measurements have been taken yet.
   */
  getAverage(): number | undefined {
    if (this.samples.length === 0) {
      return undefined;
    }
    const sum = this.samples.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / this.samples.length);
  }

  /** Resets all stored samples. */
  reset(): void {
    this.samples.length = 0;
  }

  private addSample(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }
}
