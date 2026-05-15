import { querySearchAnalytics, getSiteUrl } from "./_utils/gsc.js";
import { applyCors, handlePreflight, sendError, parseDays } from "./_utils/http.js";

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "GET") return sendError(res, 405, "Method not allowed");

  const days = parseDays(req, 90);

  try {
    const { rows, startDate, endDate } = await querySearchAnalytics({
      dimensions: ["date"],
      days,
    });

    const data = rows
      .map((r) => ({
        date: r.keys[0],
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = data.reduce(
      (acc, d) => {
        acc.clicks += d.clicks;
        acc.impressions += d.impressions;
        return acc;
      },
      { clicks: 0, impressions: 0 }
    );
    const avgCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    const avgPosition =
      data.length > 0 ? data.reduce((s, d) => s + d.position, 0) / data.length : 0;

    res.status(200).json({
      meta: {
        site: getSiteUrl(),
        startDate,
        endDate,
        days,
        rowCount: data.length,
        generatedAt: new Date().toISOString(),
      },
      totals: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: avgCtr,
        position: avgPosition,
      },
      data,
    });
  } catch (err) {
    sendError(res, 500, "Failed to fetch GSC performance data", err.message);
  }
}
