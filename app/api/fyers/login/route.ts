import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const STATE_COOKIE = "fyers_oauth_state";

function fyersConfiguration() {
  const clientId = process.env.FYERS_CLIENT_ID?.trim();
  const secretKey = process.env.FYERS_SECRET_KEY?.trim();
  const redirectUri = process.env.FYERS_REDIRECT_URI?.trim();
  if (!clientId || !secretKey || !redirectUri) {
    return null;
  }

  try {
    const parsed = new URL(redirectUri);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      (process.env.NODE_ENV === "production" &&
        parsed.protocol !== "https:")
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return { clientId, redirectUri };
}

export async function GET() {
  const configuration = fyersConfiguration();
  if (!configuration) {
    return Response.json(
      {
        error:
          "FYERS login is not configured. Set FYERS_CLIENT_ID, FYERS_SECRET_KEY, and the exact FYERS_REDIRECT_URI registered in the FYERS app.",
        code: "fyers_auth_not_configured",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const state = randomBytes(32).toString("hex");
  const authorizationUrl = new URL(
    "https://api-t1.fyers.in/api/v3/generate-authcode",
  );
  authorizationUrl.searchParams.set("client_id", configuration.clientId);
  authorizationUrl.searchParams.set(
    "redirect_uri",
    configuration.redirectUri,
  );
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/fyers/callback",
    maxAge: 10 * 60,
  });
  return response;
}
