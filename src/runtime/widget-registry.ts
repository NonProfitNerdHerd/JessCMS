import { Registry } from "./registry-base";
import type { PluginWidgetDefinition } from "./types";

export class WidgetRegistry extends Registry<PluginWidgetDefinition & { plugin_id: string }> {
  constructor() {
    super((entry) => entry.id);
  }
}

export const widgetRegistry = new WidgetRegistry();
