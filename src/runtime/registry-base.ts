export interface RegistryEntryMeta {
  pluginId: string;
  registeredAt: string;
}

export class Registry<T> {
  private entries = new Map<string, T>();
  private meta = new Map<string, RegistryEntryMeta>();
  private readonly keyOf: (entry: T) => string;

  constructor(keyOf: (entry: T) => string) {
    this.keyOf = keyOf;
  }

  register(entry: T, pluginId: string): void {
    const key = this.keyOf(entry);
    this.entries.set(key, entry);
    this.meta.set(key, {
      pluginId,
      registeredAt: new Date().toISOString(),
    });
  }

  unregister(key: string): boolean {
    this.meta.delete(key);
    return this.entries.delete(key);
  }

  get(key: string): T | undefined {
    return this.entries.get(key);
  }

  getAll(): T[] {
    return [...this.entries.values()];
  }

  exists(key: string): boolean {
    return this.entries.has(key);
  }

  getPluginId(key: string): string | undefined {
    return this.meta.get(key)?.pluginId;
  }

  validate(): string[] {
    return [];
  }

  clear(): void {
    this.entries.clear();
    this.meta.clear();
  }

  size(): number {
    return this.entries.size;
  }
}
