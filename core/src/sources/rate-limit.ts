/**
 * Minimal rate limiter — serializes requests with a minimum interval.
 * Reuses the throttling experience from the dsh-market collector
 * (pagination intervals, caching).
 */
export class RateLimiter {
  private last = 0;

  constructor(private minIntervalMs: number) {}

  /** Wait until the next allowed request slot, then return. */
  async acquire(): Promise<void> {
    const now = Date.now();
    const wait = this.last + this.minIntervalMs - now;
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.last = Date.now();
  }
}
