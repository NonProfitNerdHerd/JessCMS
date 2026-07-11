import { isAuthUser, requirePermission } from "../auth";
import { getVisualEditorBlockDefinitions, getBlockDefinitions } from "../blocks/definitions";
import { validateContentDocument, canPublishDocument } from "../blocks/validate";
import { badRequest, ok, serverError } from "../lib/response";
import { getRuntime } from "../runtime/sync";

export async function handleEditorBlocks(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  const definitions = getBlockDefinitions();
  const visual = getVisualEditorBlockDefinitions();

  const byType = new Map(definitions.map((block) => [block.type, block]));
  const items = snapshot.blocks.map((block) => {
    const meta = byType.get(block.type);
    return {
      ...block,
      category: meta?.category ?? "advanced",
      icon: meta?.icon ?? "📄",
      keywords: meta?.keywords ?? [],
      supports: meta?.supports ?? {},
      allows_children: meta?.allows_children ?? false,
      version: meta?.version ?? 1,
    };
  });

  // Ensure divider appears even if runtime catalog is stale until refresh.
  if (!items.some((block) => block.type === "divider")) {
    const divider = definitions.find((block) => block.type === "divider");
    if (divider) {
      items.push({
        type: divider.type,
        label: divider.label,
        category: divider.category,
        source: divider.source ?? "core",
        plugin_id: "jesscms-core",
        enabled: true,
        icon: divider.icon,
        keywords: divider.keywords,
        supports: divider.supports,
        allows_children: false,
        version: 1,
        props_schema: divider.props_schema,
      } as (typeof items)[number]);
    }
  }

  return ok({
    items,
    visual_editor: visual,
    core: items.filter((block) => block.plugin_id === "jesscms-core" || block.source === "core"),
    from_plugins: items.filter(
      (block) => block.plugin_id !== "jesscms-core" && block.source !== "core",
    ),
    count: items.length,
  });
}

export async function handleValidateEditorDocument(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "content:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = (await request.json()) as {
      content_json?: unknown;
      for_publish?: boolean;
    };

    const result = body.for_publish
      ? canPublishDocument(
          typeof body.content_json === "string"
            ? body.content_json
            : JSON.stringify(body.content_json ?? {}),
        )
      : validateContentDocument(
          typeof body.content_json === "string"
            ? body.content_json
            : (body.content_json as never),
        );

    return ok(result);
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
