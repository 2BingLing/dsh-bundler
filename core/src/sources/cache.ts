/**
 * Simple TTL cache for version listings — avoids hammering GitHub/npm
 * on repeated resolutions of the same id.
 */
export class TtlCache<T> {
  private map = new Map<string, { value: T; expiresAt: number }>();

  constructor(private ttlMs = 5 * 60_000) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
