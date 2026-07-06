import { Registry } from "./registry-base";
import type { RegisteredPlugin, PluginManifest } from "./types";

export class PluginRegistry extends Registry<RegisteredPlugin> {
  constructor() {
    super((entry) => entry.manifest.id);
  }

  getManifest(id: string): PluginManifest | undefined {
    return this.get(id)?.manifest;
  }

  getEnabled(): RegisteredPlugin[] {
    return this.getAll().filter((plugin) => plugin.enabled);
  }
}

export const pluginRegistry = new PluginRegistry();
