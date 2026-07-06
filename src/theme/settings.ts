import { DEFAULT_THEME_SETTINGS } from "../foundation/registry";

export interface ThemeSettings {
  theme_name: string;
  site_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  button_style: { variant?: string; radius?: string; size?: string };
  layout_width: string;
  border_radius: string;
  custom_css: string;
}

export async function loadThemeSettings(db: D1Database): Promise<ThemeSettings> {
  const rows = await db
    .prepare("SELECT key, value FROM theme_settings ORDER BY key")
    .all<{ key: string; value: string }>();

  const fromDb: Record<string, unknown> = {};
  for (const row of rows.results ?? []) {
    try {
      fromDb[row.key] = JSON.parse(row.value);
    } catch {
      fromDb[row.key] = row.value;
    }
  }

  const buttonStyle = {
    ...DEFAULT_THEME_SETTINGS.button_style,
    ...(fromDb.button_style as Record<string, unknown> | undefined),
  };

  return {
    theme_name: String(fromDb.theme_name ?? "Jess Default"),
    site_name: String(fromDb.site_name ?? DEFAULT_THEME_SETTINGS.site_name),
    logo_url: (fromDb.logo_url as string | null) ?? null,
    favicon_url: (fromDb.favicon_url as string | null) ?? null,
    primary_color: String(fromDb.primary_color ?? DEFAULT_THEME_SETTINGS.primary_color),
    secondary_color: String(fromDb.secondary_color ?? DEFAULT_THEME_SETTINGS.secondary_color),
    background_color: String(fromDb.background_color ?? DEFAULT_THEME_SETTINGS.background_color),
    text_color: String(fromDb.text_color ?? DEFAULT_THEME_SETTINGS.text_color),
    heading_font: String(fromDb.heading_font ?? DEFAULT_THEME_SETTINGS.heading_font),
    body_font: String(fromDb.body_font ?? DEFAULT_THEME_SETTINGS.body_font),
    button_style: buttonStyle,
    layout_width: String(fromDb.layout_width ?? DEFAULT_THEME_SETTINGS.layout_width),
    border_radius: String(
      fromDb.border_radius ?? buttonStyle.radius ?? "0.375rem",
    ),
    custom_css: String(fromDb.custom_css ?? ""),
  };
}

export function themeCssVariables(settings: ThemeSettings): string {
  const radius = settings.border_radius || settings.button_style.radius || "0.375rem";
  return `:root {
  --jess-site-name: ${JSON.stringify(settings.site_name)};
  --jess-primary: ${settings.primary_color};
  --jess-secondary: ${settings.secondary_color};
  --jess-bg: ${settings.background_color};
  --jess-text: ${settings.text_color};
  --jess-heading-font: ${settings.heading_font};
  --jess-body-font: ${settings.body_font};
  --jess-layout-width: ${settings.layout_width};
  --jess-radius: ${radius};
  --jess-button-radius: ${settings.button_style.radius ?? radius};
}`;
}
