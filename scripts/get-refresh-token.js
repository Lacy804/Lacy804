#!/usr/bin/env node
/**
 * One-time helper: complete the OAuth consent flow locally and print a
 * refresh token. Paste the printed token into Vercel env as GOOGLE_REFRESH_TOKEN.
 *
 * Prerequisites:
 *   1. In Google Cloud Console, create an OAuth 2.0 Client ID of type
 *      "Web application" with authorized redirect URI:
 *        http://localhost:8765/oauth/callback
 *   2. Enable the "Google Search Console API" on the project.
 *   3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your shell, e.g.:
 *        export GOOGLE_CLIENT_ID=...
 *        export GOOGLE_CLIENT_SECRET=...
 *   4. Run: node scripts/get-refresh-token.js
 *   5. Open the URL it prints, sign in with the Google account that has
 *      access to the GSC property, approve the scope.
 *
 * The script will print the refresh token and exit.
 */
import http from "node:http";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your shell first.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [SCOPE],
});

console.log("\n1) Open this URL in your browser:\n");
console.log("   " + authUrl + "\n");
console.log("2) After approving, you'll be redirected back here automatically.\n");

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth/callback")) {
    res.writeHead(404).end();
    return;
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Missing ?code");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h1>Done.</h1><p>Refresh token printed in the terminal. You can close this tab.</p>"
    );
    console.log("\n=== GOOGLE_REFRESH_TOKEN ===");
    console.log(tokens.refresh_token ?? "(no refresh token returned — re-run with prompt=consent)");
    console.log("============================\n");
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end("Token exchange failed: " + err.message);
    console.error(err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Waiting for callback on ${REDIRECT_URI} ...\n`);
});
