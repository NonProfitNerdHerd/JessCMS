# Content Type Schema

Generic content types can define custom fields via `schema_json` on the content type (manifest or `content_types` row).

## Format

```json
{
  "fields": [
    {
      "key": "location",
      "label": "Location",
      "type": "text",
      "required": false
    },
    {
      "key": "start_datetime",
      "label": "Start Date/Time",
      "type": "datetime",
      "required": true
    },
    {
      "key": "category",
      "label": "Category",
      "type": "select",
      "options": ["News", "Warning", "Event"]
    }
  ]
}
```

Values are stored in `content_entries.metadata_json` and exposed on the API as a `metadata` object.

## Supported field types

| Type | Storage | Validation |
|------|---------|------------|
| `text` | string | — |
| `textarea` | string | — |
| `number` | number | Must be numeric |
| `boolean` | boolean | true/false |
| `date` | ISO date string | Parseable date |
| `datetime` | ISO datetime string | Parseable datetime |
| `select` | string | Must match `options` when provided |
| `url` | string | Basic `http(s)://` pattern |
| `email` | string | Basic email pattern |
| `image` | string | Media ID (text) |
| `json` | any JSON value | Valid JSON |

## Validation rules

Validation runs on create and update (`src/content-entries/schema-validation.ts`):

1. **Required fields** — missing or empty values return `400`
2. **Type checking** — wrong JSON types return `400`
3. **Select options** — values outside `options` return `400`
4. **Unknown keys** — metadata keys not declared in the schema return `400`

Example error response:

```json
{
  "error": "Validation failed",
  "details": ["Target Area is required", "Unknown metadata field: foo"]
}
```

## API usage

Create/update body:

```json
{
  "title": "May 15 Chase",
  "slug": "may-15-chase",
  "metadata": {
    "target_area": "Central Oklahoma",
    "risk_level": "Moderate"
  }
}
```

Response includes parsed metadata:

```json
{
  "id": "...",
  "content_type": "chase",
  "title": "May 15 Chase",
  "metadata": {
    "target_area": "Central Oklahoma",
    "risk_level": "Moderate"
  }
}
```

## Admin UI

The generic editor renders fields from the schema automatically. Field names use `data-metadata-key` attributes; the admin client bundles them into `metadata` on save.

## Implementation

- Parser: `parseContentTypeSchema()`
- Validator: `validateMetadataAgainstSchema()`
- Repository: `src/content-entries/repository.ts`
