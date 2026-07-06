# JessCMS API Smoke Tests

PowerShell examples for Phase 3 auth and CRUD APIs.

Set your base URL:

```powershell
$BaseUrl = "http://127.0.0.1:8787"
# Production:
# $BaseUrl = "https://jesscms.ike-j-rebout.workers.dev"
```

Use a web session to persist the HttpOnly auth cookie:

```powershell
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
```

## Health

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/health"
```

## Create first admin (local)

Run once before login:

```powershell
npm run user:create-admin -- --email admin@example.com --password "ChangeMeNow123!"
```

For remote D1:

```powershell
npm run user:create-admin -- --email admin@example.com --password "ChangeMeNow123!" --remote
```

## Login

```powershell
$LoginBody = @{
  email = "admin@example.com"
  password = "ChangeMeNow123!"
} | ConvertTo-Json

$Login = Invoke-WebRequest `
  -Uri "$BaseUrl/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $LoginBody `
  -WebSession $Session

$Login.Content | ConvertFrom-Json
```

## Me

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -WebSession $Session
```

## Create page (draft)

```powershell
$PageBody = @{
  title = "About Us"
  slug = "about-us"
  status = "draft"
  excerpt = "Learn about our team."
  content_json = '{"version":1,"blocks":[]}'
} | ConvertTo-Json

$Page = Invoke-RestMethod `
  -Uri "$BaseUrl/api/pages" `
  -Method POST `
  -ContentType "application/json" `
  -Body $PageBody `
  -WebSession $Session

$PageId = $Page.data.id
$PageId
```

## Update page

```powershell
$UpdateBody = @{
  title = "About Our Team"
  excerpt = "Updated excerpt."
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "$BaseUrl/api/pages/$PageId" `
  -Method PUT `
  -ContentType "application/json" `
  -Body $UpdateBody `
  -WebSession $Session
```

## Publish page

```powershell
$PublishBody = @{
  status = "published"
  published_at = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "$BaseUrl/api/pages/$PageId" `
  -Method PUT `
  -ContentType "application/json" `
  -Body $PublishBody `
  -WebSession $Session
```

## List pages (public — published only)

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/pages"
```

## List pages (admin — all statuses)

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/pages?status=draft" -WebSession $Session
```

## Get page by slug (public)

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/pages/slug/about-us"
```

## Create post

```powershell
$PostBody = @{
  title = "Hello World"
  slug = "hello-world"
  status = "draft"
  excerpt = "First post."
  content_json = '{"version":1,"blocks":[{"id":"blk1","type":"paragraph","props":{"text":"Hello"},"children":[],"style":{},"plugin_source":null}]}'
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Uri "$BaseUrl/api/posts" `
  -Method POST `
  -ContentType "application/json" `
  -Body $PostBody `
  -WebSession $Session
```

## Create event

```powershell
$EventBody = @{
  title = "Community Meetup"
  slug = "community-meetup"
  status = "draft"
  start_datetime = (Get-Date).AddDays(14).ToUniversalTime().ToString("o")
  end_datetime = (Get-Date).AddDays(14).AddHours(2).ToUniversalTime().ToString("o")
  location_name = "Main Library"
  timezone = "America/Chicago"
  event_status = "scheduled"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "$BaseUrl/api/events" `
  -Method POST `
  -ContentType "application/json" `
  -Body $EventBody `
  -WebSession $Session
```

## Logout

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/auth/logout" -Method POST -WebSession $Session
```

## Expected failure cases

Unauthorized create:

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/pages" -Method POST -ContentType "application/json" -Body '{"title":"x","slug":"x"}'
```

Publish without `published_at`:

```powershell
# Should return 400 validation error
$BadPublish = @{ status = "published" } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/api/pages/$PageId" -Method PUT -ContentType "application/json" -Body $BadPublish -WebSession $Session
```

## Query parameters

```powershell
Invoke-RestMethod -Uri "$BaseUrl/api/posts?status=published&limit=10&offset=0"
Invoke-RestMethod -Uri "$BaseUrl/api/events?limit=5" -WebSession $Session
```
