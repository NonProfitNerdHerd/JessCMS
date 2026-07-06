import { PLUGIN_MANIFESTS, type PluginManifest } from "../foundation/registry";

export async function syncPluginsToDatabase(env: Env): Promise<void> {
  const statements = PLUGIN_MANIFESTS.map((manifest) =>
    env.DB.prepare(
      `
        INSERT INTO plugins (id, name, version, enabled, manifest_json, lifecycle_state, installed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          version = excluded.version,
          manifest_json = excluded.manifest_json,
          updated_at = datetime('now')
      `,
    ).bind(
      manifest.id,
      manifest.name,
      manifest.version,
      manifest.enabled ? 1 : 0,
      JSON.stringify(manifest),
      manifest.enabled ? "enabled" : "disabled",
    ),
  );

  await env.DB.batch(statements);
}

export function findPluginManifest(id: string): PluginManifest | undefined {
  return PLUGIN_MANIFESTS.find((plugin) => plugin.id === id);
}
