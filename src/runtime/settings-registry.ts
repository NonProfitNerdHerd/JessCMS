import { Registry } from "./registry-base";
import type { RuntimeSettingsPageDefinition } from "./types";

export class SettingsRegistry extends Registry<RuntimeSettingsPageDefinition> {
  constructor() {
    super((entry) => entry.key);
  }
}

export const settingsRegistry = new SettingsRegistry();
