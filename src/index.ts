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
import { handleHealth } from "./routes/health";
import { handlePlugins, handleUpdatePlugin } from "./routes/plugins";
import {
  handleEditorBlocks,
  handleThemeSettings,
  handleUpdateThemeSettings,
} from "./routes/theme-settings";
import { handlePublicRequest } from "./public/handler";
import { serverError } from "./lib/response";

const ROUTES: RouteDefinition[] = [
  staticRoute("GET", "/api/health", (_request, env) => handleHealth(env)),

  staticRoute("POST", "/api/auth/login", handleLogin),
  staticRoute("POST", "/api/auth/logout", handleLogout),
  staticRoute("GET", "/api/auth/me", handleMe),
  staticRoute("PUT", "/api/auth/profile", handleUpdateProfile),

  staticRoute("GET", "/api/pages", handleListPages),
  paramRoute("GET", "/api/pages/slug/:slug", handleGetPageBySlug),
  paramRoute("GET", "/api/pages/:id", handleGetPageById),
  staticRoute("POST", "/api/pages", handleCreatePage),
  paramRoute("PUT", "/api/pages/:id", handleUpdatePage),
  paramRoute("DELETE", "/api/pages/:id", handleDeletePage),

  staticRoute("GET", "/api/posts", handleListPosts),
  paramRoute("GET", "/api/posts/slug/:slug", handleGetPostBySlug),
  paramRoute("GET", "/api/posts/:id", handleGetPostById),
  staticRoute("POST", "/api/posts", handleCreatePost),
  paramRoute("PUT", "/api/posts/:id", handleUpdatePost),
  paramRoute("DELETE", "/api/posts/:id", handleDeletePost),

  staticRoute("GET", "/api/events", handleListEvents),
  paramRoute("GET", "/api/events/slug/:slug", handleGetEventBySlug),
  paramRoute("GET", "/api/events/:id", handleGetEventById),
  staticRoute("POST", "/api/events", handleCreateEvent),
  paramRoute("PUT", "/api/events/:id", handleUpdateEvent),
  paramRoute("DELETE", "/api/events/:id", handleDeleteEvent),

  staticRoute("GET", "/api/content/types", (_request, env) => handleContentTypes(env)),
  staticRoute("GET", "/api/plugins", (_request, env) => handlePlugins(env)),
  paramRoute("PUT", "/api/plugins/:id", handleUpdatePlugin),
  staticRoute("GET", "/api/theme/settings", (_request, env) => handleThemeSettings(env)),
  staticRoute("PUT", "/api/theme/settings", handleUpdateThemeSettings),
  staticRoute("GET", "/api/editor/blocks", (_request, env) => handleEditorBlocks(env)),
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
