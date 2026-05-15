import { applyCors, handlePreflight } from "./_utils/http.js";

export default function handler(req, res) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  const env = process.env;
  res.status(200).json({
    ok: true,
    site: env.GSC_SITE_URL ?? null,
    configured: {
      clientId: Boolean(env.GOOGLE_CLIENT_ID),
      clientSecret: Boolean(env.GOOGLE_CLIENT_SECRET),
      refreshToken: Boolean(env.GOOGLE_REFRESH_TOKEN),
      siteUrl: Boolean(env.GSC_SITE_URL),
      allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
    },
    time: new Date().toISOString(),
  });
}
