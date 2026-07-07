import { genericAdminBase, isLegacyContentType } from "../content-entries/registry";
import type { ContentIndexRecord } from "../foundation/types";

export function resolveAdminEditUrl(record: Pick<
  ContentIndexRecord,
  "content_type" | "source_id" | "source_table"
>): string {
  switch (record.content_type) {
    case "page":
      return `/admin/pages/${record.source_id}`;
    case "post":
      return `/admin/posts/${record.source_id}`;
    case "event":
      return `/admin/events/${record.source_id}`;
    case "form":
      return `/admin/forms/${record.source_id}`;
    case "media":
      return `/admin/media/${record.source_id}`;
    default:
      if (isLegacyContentType(record.content_type)) {
        return `/admin/${record.content_type}s/${record.source_id}`;
      }
      return `${genericAdminBase(record.content_type)}/${record.source_id}`;
  }
}
