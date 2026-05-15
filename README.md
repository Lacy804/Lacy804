# GSC Dashboard Backend

Vercel serverless backend that exposes Google Search Console **Performance** data as JSON, for consumption by a Lovable dashboard embedded via iframe on `clearleaddigital.com`.

## What's exposed

| Endpoint           | Dimension | Default `?days=` | Default `?limit=` |
| ------------------ | --------- | ---------------- | ----------------- |
| `/api/performance` | `date`    | 90               | n/a               |
| `/api/pages`       | `page`    | 90               | 500 (max 5000)    |
| `/api/queries`     | `query`   | 90               | 500 (max 5000)    |
| `/api/countries`   | `country` | 90               | 250 (max 1000)    |
| `/api/devices`     | `device`  | 90               | n/a               |
| `/api/health`      | —         | —                | —                 |

All endpoints accept `?days=N` (max 480, GSC retains ~16 months). Page/query/country endpoints accept `?limit=N`.

Response shape:
```json
{
  "meta": { "site": "...", "startDate": "...", "endDate": "...", "days": 90, "rowCount": 42, "generatedAt": "..." },
  "totals": { "clicks": 0, "impressions": 0, "ctr": 0, "position": 0 },  // only on /api/performance
  "data":  [ { ...row... } ]
}
```

Responses are cached at the Vercel edge for 1 hour (`s-maxage=3600`) with `stale-while-revalidate=86400`. GSC data has a 2-3 day lag, so this won't show stale info from the dashboard's perspective.

## What's NOT exposed

GSC's public API does **not** include Crawl Stats (Googlebot requests, redirect rates, response times, file-type breakdowns). That data is only available via the GSC UI's Settings → Crawl stats page. If you need it in the dashboard, options are:
1. Manual CSV export → drop into a `data/` folder and add a separate CSV-reading endpoint.
2. Headless-browser scrape (fragile, against GSC ToS — not recommended).

## Setup

### 1. Google Cloud project

1. Create or pick a project at https://console.cloud.google.com.
2. **Enable** "Google Search Console API" under APIs & Services → Library.
3. Under APIs & Services → **OAuth consent screen**, configure as "External" with your email as a test user. Add scope `https://www.googleapis.com/auth/webmasters.readonly`.
4. Under APIs & Services → **Credentials**, create an "OAuth 2.0 Client ID" of type **Web application**:
   - Authorized redirect URI: `http://localhost:8765/oauth/callback`
5. Copy the Client ID and Client Secret.

### 2. Generate the refresh token (one-time)

```bash
npm install
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
npm run get-token
```

Open the URL it prints, sign in with the Google account that has access to the GSC property, approve. The terminal prints `GOOGLE_REFRESH_TOKEN=...`.

### 3. Deploy to Vercel

```bash
npx vercel link        # link this directory to a Vercel project
npx vercel env add GOOGLE_CLIENT_ID production
npx vercel env add GOOGLE_CLIENT_SECRET production
npx vercel env add GOOGLE_REFRESH_TOKEN production
npx vercel env add GSC_SITE_URL production           # e.g. sc-domain:ironcladpm.com
npx vercel env add ALLOWED_ORIGINS production        # e.g. https://clearleaddigital.com,https://www.clearleaddigital.com
npx vercel --prod
```

### 4. Wire up Lovable

In your Lovable dashboard, fetch from the deployed URLs, e.g.:

```js
const base = "https://your-project.vercel.app";
const perf = await fetch(`${base}/api/performance?days=90`).then(r => r.json());
const pages = await fetch(`${base}/api/pages?days=90&limit=100`).then(r => r.json());
```

CORS is restricted to whatever you set in `ALLOWED_ORIGINS`. Add the Lovable preview domain (e.g. `https://preview--your-app.lovable.app`) during development if needed.

## Local dev

```bash
cp .env.example .env
# fill in .env
npm install
npx vercel dev
# → http://localhost:3000/api/health
```

## Notes on GSC site URL format

- **Domain property** (recommended): `sc-domain:ironcladpm.com` — captures every protocol/subdomain variant in one query. Best for the ironcladpm.com data which has both `http://www.` and `https://` versions of the homepage being indexed separately.
- **URL-prefix property**: `https://ironcladpm.com/` — exact match only. You'd need a separate property/query per variant.

## Adding more dimensions

GSC's `searchanalytics.query` supports combining dimensions (e.g. `["page", "query"]`). To add a "top queries per page" endpoint, copy `api/pages.js` and pass `dimensions: ["page", "query"]` plus appropriate row mapping. See `api/_utils/gsc.js` for the wrapper.
