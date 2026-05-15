import { google } from "googleapis";

let cachedClient = null;

function getOAuthClient() {
  if (cachedClient) return cachedClient;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Missing Google OAuth env vars. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN."
    );
  }

  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  cachedClient = client;
  return client;
}

export function getSearchConsole() {
  return google.searchconsole({ version: "v1", auth: getOAuthClient() });
}

export function getSiteUrl() {
  const url = process.env.GSC_SITE_URL;
  if (!url) throw new Error("Missing GSC_SITE_URL env var.");
  return url;
}

export function dateRange(days = 90) {
  // GSC has a 2-3 day data lag; query through "today" and let the API return what it has.
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function querySearchAnalytics({
  dimensions,
  days = 90,
  rowLimit = 25000,
  searchType = "web",
}) {
  const sc = getSearchConsole();
  const { startDate, endDate } = dateRange(days);

  const rows = [];
  let startRow = 0;
  const pageSize = Math.min(rowLimit, 25000);

  while (rows.length < rowLimit) {
    const { data } = await sc.searchanalytics.query({
      siteUrl: getSiteUrl(),
      requestBody: {
        startDate,
        endDate,
        dimensions,
        type: searchType,
        rowLimit: pageSize,
        startRow,
      },
    });

    const batch = data.rows ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    startRow += pageSize;
  }

  return { rows: rows.slice(0, rowLimit), startDate, endDate };
}
