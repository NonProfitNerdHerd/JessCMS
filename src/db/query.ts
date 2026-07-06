export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const statement = db.prepare(sql);
  const result =
    params.length > 0
      ? await statement.bind(...params).all<T>()
      : await statement.all<T>();

  return result.results ?? [];
}

export async function checkDbConnection(db: D1Database): Promise<boolean> {
  const result = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return result?.ok === 1;
}
