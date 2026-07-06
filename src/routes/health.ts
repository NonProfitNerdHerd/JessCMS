import { checkDbConnection } from "../db";
import { ok } from "../lib/response";

export async function handleHealth(env: Env): Promise<Response> {
  const dbOk = await checkDbConnection(env.DB);

  return ok({
    status: "ok",
    service: "jesscms",
    database: dbOk ? "connected" : "unavailable",
    timestamp: new Date().toISOString(),
  });
}
