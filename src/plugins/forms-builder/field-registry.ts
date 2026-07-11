/**
 * Central field registry for the forms platform.
 * Each field type declares defaults, capabilities, and formatting helpers.
 */

export type FieldCategory =
  | "basic"
  | "choice"
  | "advanced"
  | "layout"
  | "content";

export interface FieldTypeDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: FieldCategory;
  version: number;
  keywords: string[];
  supportsRequired: boolean;
  supportsDefault: boolean;
  supportsPlaceholder: boolean;
  supportsChoices: boolean;
  supportsWidth: boolean;
  storesValue: boolean;
  isSensitive?: boolean;
  defaultLabel: string;
  defaultSettings?: Record<string, unknown>;
  defaultValidation?: Record<string, unknown>;
  defaultOptions?: Record<string, unknown>;
}

const REGISTRY: FieldTypeDefinition[] = [
  {
    type: "text",
    label: "Single Line Text",
    description: "Short text input",
    icon: "T",
    category: "basic",
    version: 1,
    keywords: ["text", "input", "name"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Text",
  },
  {
    type: "textarea",
    label: "Paragraph Text",
    description: "Multi-line text",
    icon: "¶",
    category: "basic",
    version: 1,
    keywords: ["textarea", "message", "paragraph"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Message",
    defaultSettings: { rows: 4 },
  },
  {
    type: "email",
    label: "Email",
    description: "Email address",
    icon: "@",
    category: "basic",
    version: 1,
    keywords: ["email", "mail"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Email",
  },
  {
    type: "phone",
    label: "Phone",
    description: "Phone number",
    icon: "☎",
    category: "basic",
    version: 1,
    keywords: ["phone", "tel", "mobile"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Phone",
  },
  {
    type: "number",
    label: "Number",
    description: "Numeric input",
    icon: "#",
    category: "basic",
    version: 1,
    keywords: ["number", "amount"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Number",
  },
  {
    type: "url",
    label: "Website / URL",
    description: "Web address",
    icon: "🔗",
    category: "basic",
    version: 1,
    keywords: ["url", "website", "link"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Website",
  },
  {
    type: "hidden",
    label: "Hidden",
    description: "Hidden value",
    icon: "◌",
    category: "advanced",
    version: 1,
    keywords: ["hidden", "meta"],
    supportsRequired: false,
    supportsDefault: true,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: false,
    storesValue: true,
    defaultLabel: "Hidden",
  },
  {
    type: "name",
    label: "Name",
    description: "First and last name",
    icon: "👤",
    category: "basic",
    version: 1,
    keywords: ["name", "first", "last"],
    supportsRequired: true,
    supportsDefault: false,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Name",
    defaultSettings: {
      show_prefix: false,
      show_middle: false,
      show_suffix: false,
      show_first: true,
      show_last: true,
    },
  },
  {
    type: "address",
    label: "Address",
    description: "Postal address",
    icon: "⌂",
    category: "basic",
    version: 1,
    keywords: ["address", "city", "postal", "country"],
    supportsRequired: true,
    supportsDefault: false,
    supportsPlaceholder: true,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Address",
    defaultSettings: {
      show_line2: true,
      show_city: true,
      show_state: true,
      show_postal: true,
      show_country: true,
    },
  },
  {
    type: "select",
    label: "Dropdown",
    description: "Select one option",
    icon: "▾",
    category: "choice",
    version: 1,
    keywords: ["select", "dropdown"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: true,
    supportsChoices: true,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Dropdown",
    defaultOptions: {
      choices: [
        { label: "Option 1", value: "option-1" },
        { label: "Option 2", value: "option-2" },
      ],
    },
  },
  {
    type: "radio",
    label: "Radio Buttons",
    description: "Choose one",
    icon: "◉",
    category: "choice",
    version: 1,
    keywords: ["radio", "choice"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: false,
    supportsChoices: true,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Radio",
    defaultOptions: {
      choices: [
        { label: "Option 1", value: "option-1" },
        { label: "Option 2", value: "option-2" },
      ],
    },
  },
  {
    type: "checkbox",
    label: "Checkboxes",
    description: "Choose one or more",
    icon: "☑",
    category: "choice",
    version: 1,
    keywords: ["checkbox", "multi"],
    supportsRequired: true,
    supportsDefault: false,
    supportsPlaceholder: false,
    supportsChoices: true,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Checkboxes",
    defaultOptions: {
      choices: [
        { label: "Option 1", value: "option-1" },
        { label: "Option 2", value: "option-2" },
      ],
    },
    defaultSettings: { multiple: true },
  },
  {
    type: "yes_no",
    label: "Yes / No",
    description: "Binary choice",
    icon: "◐",
    category: "choice",
    version: 1,
    keywords: ["yes", "no", "boolean"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Yes / No",
    defaultSettings: { yes_label: "Yes", no_label: "No" },
  },
  {
    type: "date",
    label: "Date",
    description: "Date picker",
    icon: "📅",
    category: "basic",
    version: 1,
    keywords: ["date", "calendar"],
    supportsRequired: true,
    supportsDefault: true,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "Date",
  },
  {
    type: "consent",
    label: "Consent",
    description: "Required agreement",
    icon: "✓",
    category: "advanced",
    version: 1,
    keywords: ["consent", "privacy", "terms"],
    supportsRequired: true,
    supportsDefault: false,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: true,
    defaultLabel: "I agree to the terms",
    defaultSettings: { consent_version: "1" },
  },
  {
    type: "heading",
    label: "Heading",
    description: "Section heading (no value)",
    icon: "H",
    category: "content",
    version: 1,
    keywords: ["heading", "title"],
    supportsRequired: false,
    supportsDefault: false,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: false,
    defaultLabel: "Section heading",
    defaultSettings: { level: 3 },
  },
  {
    type: "paragraph_content",
    label: "Paragraph",
    description: "Informational text (no value)",
    icon: "¶",
    category: "content",
    version: 1,
    keywords: ["content", "instructions", "html"],
    supportsRequired: false,
    supportsDefault: false,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: false,
    defaultLabel: "Add instructions for the submitter.",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visual separator",
    icon: "—",
    category: "layout",
    version: 1,
    keywords: ["divider", "separator", "hr"],
    supportsRequired: false,
    supportsDefault: false,
    supportsPlaceholder: false,
    supportsChoices: false,
    supportsWidth: true,
    storesValue: false,
    defaultLabel: "Divider",
  },
];

export const FOUNDATIONAL_FIELD_TYPES = REGISTRY.map((entry) => entry.type);

export function getFieldTypeDefinitions(): FieldTypeDefinition[] {
  return REGISTRY.slice();
}

export function getFieldTypeDefinition(type: string): FieldTypeDefinition | undefined {
  return REGISTRY.find((entry) => entry.type === type);
}

export function getFieldTypesByCategory(): Record<FieldCategory, FieldTypeDefinition[]> {
  const groups: Record<FieldCategory, FieldTypeDefinition[]> = {
    basic: [],
    choice: [],
    advanced: [],
    layout: [],
    content: [],
  };
  for (const entry of REGISTRY) {
    groups[entry.category].push(entry);
  }
  return groups;
}

export function isValidFieldType(type: string): boolean {
  return REGISTRY.some((entry) => entry.type === type);
}

export function createDefaultFieldProps(type: string): {
  label: string;
  field_type: string;
  options?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  settings?: Record<string, unknown>;
} {
  const def = getFieldTypeDefinition(type) ?? getFieldTypeDefinition("text")!;
  return {
    label: def.defaultLabel,
    field_type: def.type,
    options: def.defaultOptions ? { ...def.defaultOptions } : undefined,
    validation: def.defaultValidation ? { ...def.defaultValidation } : undefined,
    settings: def.defaultSettings ? { ...def.defaultSettings } : undefined,
  };
}
