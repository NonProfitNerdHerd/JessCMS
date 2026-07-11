export interface BlockStyle {
  textAlign?: "left" | "center" | "right";
  margin?: string;
  padding?: string;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
  anchor?: string;
  width?: "default" | "wide" | "full";
  [key: string]: unknown;
}

export interface Block {
  id: string;
  type: string;
  /** Type-specific content (WordPress-style "attributes" map here). */
  props: Record<string, unknown>;
  children: Block[];
  style: BlockStyle;
  plugin_source: string | null;
}

export interface ContentDocument {
  version: number;
  blocks: Block[];
}

export type BlockCategory =
  | "text"
  | "media"
  | "layout"
  | "design"
  | "content"
  | "marketing"
  | "dynamic"
  | "advanced";

export interface BlockSupports {
  align?: Array<"default" | "wide" | "full" | "left" | "center" | "right">;
  spacing?: boolean;
  background?: boolean;
  color?: boolean;
  anchor?: boolean;
  className?: boolean;
  nesting?: boolean;
}

export interface BlockDefinitionMeta {
  type: string;
  label: string;
  description?: string;
  category: BlockCategory;
  icon?: string;
  version?: number;
  keywords?: string[];
  allows_children?: boolean;
  allowed_parents?: string[] | null;
  allowed_children?: string[] | null;
  supports?: BlockSupports;
  props_schema?: Record<string, unknown>;
  source?: string;
}

export interface BlockValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  block_id?: string;
  path?: string;
}

export interface BlockValidationResult {
  valid: boolean;
  errors: BlockValidationIssue[];
  warnings: BlockValidationIssue[];
}
