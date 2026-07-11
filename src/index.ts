import { handleAdminRequest } from "./admin/handlers";
import { matchRoute, paramRoute, staticRoute, type RouteDefinition } from "./router";
import { handleLogin, handleLogout, handleMe, handleUpdateProfile } from "./routes/auth";
import {
  handleCreateEvent,
  handleCreatePage,
  handleCreatePost,
  handleDeleteEvent,
  handleDeletePage,
  handleDeletePost,
  handleGetEventById,
  handleGetEventBySlug,
  handleGetPageById,
  handleGetPageBySlug,
  handleGetPostById,
  handleGetPostBySlug,
  handleListEvents,
  handleListPages,
  handleListPosts,
  handleUpdateEvent,
  handleUpdatePage,
  handleUpdatePost,
} from "./routes/content";
import { handleContentTypes } from "./routes/content-types";
import {
  handleCompareGenericRevisions,
  handleCreateGenericContent,
  handleDeleteGenericContent,
  handleGetGenericContentById,
  handleGetGenericContentBySlug,
  handleGetGenericRevision,
  handleGetGenericWorkflow,
  handleListGenericContent,
  handleListGenericRevisions,
  handleRestoreGenericRevision,
  handleUpdateGenericContent,
  handleUpdateGenericWorkflow,
} from "./routes/generic-content";
import { handleHealth } from "./routes/health";
import {
  handleDisablePlugin,
  handleEnablePlugin,
  handleGetPluginResources,
  handlePlugins,
  handleUninstallPlugin,
  handleUninstallPreview,
  handleUpdatePlugin,
} from "./routes/plugins";
import {
  handleRuntimeBlocks,
  handleRuntimeContentTypes,
  handleRuntimeNavigation,
  handleRuntimePermissions,
  handleRuntimePlugins,
  handleRuntimeRefresh,
  handleRuntimeRoutes,
  handleRuntimeSettings,
  handleRuntimeSync,
} from "./routes/runtime";
import {
  handleEditorBlocks,
  handleThemeSettings,
  handleUpdateThemeSettings,
  handleValidateEditorDocument,
} from "./routes/theme-settings";
import {
  handleCreateMedia,
  handleDeleteMedia,
  handleGetMediaById,
  handleListMedia,
  handleUpdateMedia,
  handleUploadMedia,
} from "./routes/media";
import { handleServeMediaFile } from "./routes/media-serve";
import {
  handleAdminSearch,
  handlePublicSearch,
  handleRebuildSearchIndex,
} from "./routes/search";
import { registerFormsBuilderPlugin } from "./plugins/forms-builder";
import {
  handleCreateForm,
  handleCreateFormField,
  handleDeleteForm,
  handleDeleteFormField,
  handleDeleteSubmission,
  handleGetForm,
  handleGetSubmission,
  handleListFormSubmissions,
  handleListForms,
  handlePublicGetForm,
  handlePublicSubmitForm,
  handleReorderFormFields,
  handleUpdateForm,
  handleUpdateFormField,
  handleUpdateSubmission,
} from "./plugins/forms-builder/routes";
import {
  handleCompareEventRevisions,
  handleComparePageRevisions,
  handleComparePostRevisions,
  handleGetEventRevision,
  handleGetEventWorkflow,
  handleGetPageRevision,
  handleGetPageWorkflow,
  handleGetPostRevision,
  handleGetPostWorkflow,
  handleListEventRevisions,
  handleListPageRevisions,
  handleListPostRevisions,
  handleRestoreEventRevision,
  handleRestorePageRevision,
  handleRestorePostRevision,
  handleUpdateEventWorkflow,
  handleUpdatePageWorkflow,
  handleUpdatePostWorkflow,
} from "./routes/workflow-revisions";
import { handleListAuditLogs } from "./routes/audit";
import {
  handleCreateRole,
  handleGetRole,
  handleListPermissions,
  handleListRoles,
  handleUpdateRole,
} from "./routes/roles";
import {
  handleCreateUser,
  handleDisableUser,
  handleEnableUser,
  handleGetUser,
  handleListUsers,
  handleResetUserPassword,
  handleUpdateUser,
} from "./routes/users";
import { handlePublicRequest } from "./public/handler";
import { serverError } from "./lib/response";

registerFormsBuilderPlugin();

const ROUTES: RouteDefinition[] = [
  staticRoute("GET", "/api/health", (_request, env) => handleHealth(env)),

  staticRoute("POST", "/api/auth/login", handleLogin),
  staticRoute("POST", "/api/auth/logout", handleLogout),
  staticRoute("GET", "/api/auth/me", handleMe),
  staticRoute("PUT", "/api/auth/profile", handleUpdateProfile),

  staticRoute("GET", "/api/users", handleListUsers),
  paramRoute("GET", "/api/users/:id", (request, env, params) =>
    handleGetUser(request, env, params.id),
  ),
  staticRoute("POST", "/api/users", handleCreateUser),
  paramRoute("PUT", "/api/users/:id", (request, env, params) =>
    handleUpdateUser(request, env, params.id),
  ),
  paramRoute("POST", "/api/users/:id/disable", (request, env, params) =>
    handleDisableUser(request, env, params.id),
  ),
  paramRoute("POST", "/api/users/:id/enable", (request, env, params) =>
    handleEnableUser(request, env, params.id),
  ),
  paramRoute("POST", "/api/users/:id/reset-password", (request, env, params) =>
    handleResetUserPassword(request, env, params.id),
  ),

  staticRoute("GET", "/api/roles", handleListRoles),
  staticRoute("GET", "/api/permissions", handleListPermissions),
  paramRoute("GET", "/api/roles/:id", (request, env, params) =>
    handleGetRole(request, env, params.id),
  ),
  staticRoute("POST", "/api/roles", handleCreateRole),
  paramRoute("PUT", "/api/roles/:id", (request, env, params) =>
    handleUpdateRole(request, env, params.id),
  ),

  staticRoute("GET", "/api/audit", handleListAuditLogs),

  staticRoute("GET", "/api/pages", handleListPages),
  paramRoute("GET", "/api/pages/:id/revisions/compare", handleComparePageRevisions),
  paramRoute("POST", "/api/pages/:id/revisions/:revisionId/restore", handleRestorePageRevision),
  paramRoute("GET", "/api/pages/:id/revisions/:revisionId", handleGetPageRevision),
  paramRoute("GET", "/api/pages/:id/revisions", handleListPageRevisions),
  paramRoute("GET", "/api/pages/:id/workflow", handleGetPageWorkflow),
  paramRoute("PUT", "/api/pages/:id/workflow", handleUpdatePageWorkflow),
  paramRoute("GET", "/api/pages/slug/:slug", handleGetPageBySlug),
  paramRoute("GET", "/api/pages/:id", handleGetPageById),
  staticRoute("POST", "/api/pages", handleCreatePage),
  paramRoute("PUT", "/api/pages/:id", handleUpdatePage),
  paramRoute("DELETE", "/api/pages/:id", handleDeletePage),

  staticRoute("GET", "/api/posts", handleListPosts),
  paramRoute("GET", "/api/posts/:id/revisions/compare", handleComparePostRevisions),
  paramRoute("POST", "/api/posts/:id/revisions/:revisionId/restore", handleRestorePostRevision),
  paramRoute("GET", "/api/posts/:id/revisions/:revisionId", handleGetPostRevision),
  paramRoute("GET", "/api/posts/:id/revisions", handleListPostRevisions),
  paramRoute("GET", "/api/posts/:id/workflow", handleGetPostWorkflow),
  paramRoute("PUT", "/api/posts/:id/workflow", handleUpdatePostWorkflow),
  paramRoute("GET", "/api/posts/slug/:slug", handleGetPostBySlug),
  paramRoute("GET", "/api/posts/:id", handleGetPostById),
  staticRoute("POST", "/api/posts", handleCreatePost),
  paramRoute("PUT", "/api/posts/:id", handleUpdatePost),
  paramRoute("DELETE", "/api/posts/:id", handleDeletePost),

  staticRoute("GET", "/api/events", handleListEvents),
  paramRoute("GET", "/api/events/:id/revisions/compare", handleCompareEventRevisions),
  paramRoute("POST", "/api/events/:id/revisions/:revisionId/restore", handleRestoreEventRevision),
  paramRoute("GET", "/api/events/:id/revisions/:revisionId", handleGetEventRevision),
  paramRoute("GET", "/api/events/:id/revisions", handleListEventRevisions),
  paramRoute("GET", "/api/events/:id/workflow", handleGetEventWorkflow),
  paramRoute("PUT", "/api/events/:id/workflow", handleUpdateEventWorkflow),
  paramRoute("GET", "/api/events/slug/:slug", handleGetEventBySlug),
  paramRoute("GET", "/api/events/:id", handleGetEventById),
  staticRoute("POST", "/api/events", handleCreateEvent),
  paramRoute("PUT", "/api/events/:id", handleUpdateEvent),
  paramRoute("DELETE", "/api/events/:id", handleDeleteEvent),

  staticRoute("GET", "/api/content/types", (_request, env) => handleContentTypes(env)),

  paramRoute("GET", "/api/content/:contentType/slug/:slug", handleGetGenericContentBySlug),
  paramRoute("GET", "/api/content/:contentType/:id/revisions/compare", handleCompareGenericRevisions),
  paramRoute("POST", "/api/content/:contentType/:id/revisions/:revisionId/restore", handleRestoreGenericRevision),
  paramRoute("GET", "/api/content/:contentType/:id/revisions/:revisionId", handleGetGenericRevision),
  paramRoute("GET", "/api/content/:contentType/:id/revisions", handleListGenericRevisions),
  paramRoute("GET", "/api/content/:contentType/:id/workflow", handleGetGenericWorkflow),
  paramRoute("PUT", "/api/content/:contentType/:id/workflow", handleUpdateGenericWorkflow),
  paramRoute("GET", "/api/content/:contentType/:id", handleGetGenericContentById),
  paramRoute("PUT", "/api/content/:contentType/:id", handleUpdateGenericContent),
  paramRoute("DELETE", "/api/content/:contentType/:id", handleDeleteGenericContent),
  paramRoute("GET", "/api/content/:contentType", handleListGenericContent),
  paramRoute("POST", "/api/content/:contentType", handleCreateGenericContent),

  staticRoute("GET", "/api/plugins", (_request, env) => handlePlugins(env)),
  paramRoute("GET", "/api/plugins/:id/resources", handleGetPluginResources),
  paramRoute("POST", "/api/plugins/:id/enable", handleEnablePlugin),
  paramRoute("POST", "/api/plugins/:id/disable", handleDisablePlugin),
  paramRoute("POST", "/api/plugins/:id/uninstall-preview", handleUninstallPreview),
  paramRoute("POST", "/api/plugins/:id/uninstall", handleUninstallPlugin),
  paramRoute("PUT", "/api/plugins/:id", handleUpdatePlugin),

  staticRoute("GET", "/api/runtime/plugins", (_request, env) => handleRuntimePlugins(env)),
  staticRoute("GET", "/api/runtime/content-types", (_request, env) => handleRuntimeContentTypes(env)),
  staticRoute("GET", "/api/runtime/blocks", (_request, env) => handleRuntimeBlocks(env)),
  staticRoute("GET", "/api/runtime/routes", (_request, env) => handleRuntimeRoutes(env)),
  staticRoute("GET", "/api/runtime/navigation", (_request, env) => handleRuntimeNavigation(env)),
  staticRoute("GET", "/api/runtime/settings", (_request, env) => handleRuntimeSettings(env)),
  staticRoute("GET", "/api/runtime/permissions", (_request, env) => handleRuntimePermissions(env)),
  staticRoute("POST", "/api/runtime/refresh", handleRuntimeRefresh),
  staticRoute("POST", "/api/runtime/sync", handleRuntimeSync),
  staticRoute("GET", "/api/theme/settings", (_request, env) => handleThemeSettings(env)),
  staticRoute("PUT", "/api/theme/settings", handleUpdateThemeSettings),
  staticRoute("GET", "/api/editor/blocks", (_request, env) => handleEditorBlocks(env)),
  staticRoute("POST", "/api/editor/validate", handleValidateEditorDocument),

  staticRoute("GET", "/api/search", handlePublicSearch),
  staticRoute("GET", "/api/search/admin", handleAdminSearch),
  staticRoute("POST", "/api/search/rebuild", handleRebuildSearchIndex),

  staticRoute("GET", "/api/media", handleListMedia),
  staticRoute("POST", "/api/media/upload", handleUploadMedia),
  paramRoute("GET", "/api/media/:id", handleGetMediaById),
  staticRoute("POST", "/api/media", handleCreateMedia),
  paramRoute("PUT", "/api/media/:id", handleUpdateMedia),
  paramRoute("DELETE", "/api/media/:id", handleDeleteMedia),

  staticRoute("GET", "/api/forms", handleListForms),
  staticRoute("POST", "/api/forms", handleCreateForm),
  paramRoute("GET", "/api/forms/submissions/:submissionId", handleGetSubmission),
  paramRoute("PUT", "/api/forms/submissions/:submissionId", handleUpdateSubmission),
  paramRoute("DELETE", "/api/forms/submissions/:submissionId", handleDeleteSubmission),
  paramRoute("GET", "/api/forms/:id/submissions", handleListFormSubmissions),
  paramRoute("POST", "/api/forms/:id/fields/reorder", handleReorderFormFields),
  paramRoute("POST", "/api/forms/:id/fields", handleCreateFormField),
  paramRoute("PUT", "/api/forms/:id/fields/:fieldId", handleUpdateFormField),
  paramRoute("DELETE", "/api/forms/:id/fields/:fieldId", handleDeleteFormField),
  paramRoute("GET", "/api/forms/:id", handleGetForm),
  paramRoute("PUT", "/api/forms/:id", handleUpdateForm),
  paramRoute("DELETE", "/api/forms/:id", handleDeleteForm),

  paramRoute("GET", "/api/public/forms/:slug", handlePublicGetForm),
  paramRoute("POST", "/api/public/forms/:slug/submit", handlePublicSubmitForm),
];

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    try {
      const adminResponse = await handleAdminRequest(request, env);
      if (adminResponse) {
        return adminResponse;
      }

      if (
        (request.method === "GET" || request.method === "HEAD") &&
        url.pathname.startsWith("/media/")
      ) {
        return handleServeMediaFile(request, env);
      }

      const matched = matchRoute(request.method, url.pathname, ROUTES);
      if (matched) {
        return matched.handler(request, env, matched.params);
      }

      const publicResponse = await handlePublicRequest(request, env);
      if (publicResponse) {
        return publicResponse;
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      const { notFound } = await import("./lib/response");
      return notFound();
    } catch (error) {
      console.error(error);
      return serverError();
    }
  },
} satisfies ExportedHandler<Env>;
