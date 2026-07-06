import { Registry } from "./registry-base";
import type { PluginScheduledJobDefinition } from "./types";

export class SchedulerRegistry extends Registry<PluginScheduledJobDefinition> {
  constructor() {
    super((entry) => `${entry.id}`);
  }
}

export const schedulerRegistry = new SchedulerRegistry();
