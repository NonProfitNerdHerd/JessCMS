import { Registry } from "./registry-base";

export interface NotificationDefinition {
  id: string;
  label: string;
  plugin_id: string;
}

export class NotificationRegistry extends Registry<NotificationDefinition> {
  constructor() {
    super((entry) => entry.id);
  }
}

export const notificationRegistry = new NotificationRegistry();
