import { querySearchAnalytics, getSiteUrl } from "./_utils/gsc.js";
import { applyCors, handlePreflight, sendError, parseDays } from "./_utils/http.js";

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "GET") return sendError(res, 405, "Method not allowed");

  const days = parseDays(req, 90);

  try {
    const { rows, startDate, endDate } = await querySearchAnalytics({
      dimensions: ["device"],
      days,
    });

    const data = rows
      .map((r) => ({
        device: r.keys[0], // "MOBILE" | "DESKTOP" | "TABLET"
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    res.status(200).json({
      meta: {
        site: getSiteUrl(),
        startDate,
        endDate,
        days,
        rowCount: data.length,
        generatedAt: new Date().toISOString(),
      },
      data,
    });
  } catch (err) {
    sendError(res, 500, "Failed to fetch GSC device data", err.message);
  }
}
