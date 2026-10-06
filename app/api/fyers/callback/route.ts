import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const STATE_COOKIE = "fyers_oauth_state";
const ACCESS_TOKEN_COOKIE = "fyers_access_token";
const FYERS_TOKEN_URL = "https://api-t1.fyers.in/api/v3/validate-authcode";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesState(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function errorResponse(message: string, status: number): NextResponse {
  const response = NextResponse.json(
    { error: message, code: "fyers_auth_failed" },
    { status, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/fyers/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authCode = url.searchParams.get("auth_code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const clientId = process.env.FYERS_CLIENT_ID?.trim();
  const secretKey = process.env.FYERS_SECRET_KEY?.trim();
  const redirectUri = process.env.FYERS_REDIRECT_URI?.trim();

  if (!authCode || !state || !expectedState || !matchesState(expectedState, state)) {
    return errorResponse("FYERS authorization could not be verified.", 400);
  }
  if (!clientId || !secretKey || !redirectUri) {
    return errorResponse("FYERS server credentials are not configured.", 503);
  }

  const appIdHash = createHash("sha256")
    .update(`${clientId}:${secretKey}`)
    .digest("hex");

  let response: Response;
  try {
    response = await fetch(FYERS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: authCode,
        appIdHash,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return errorResponse("FYERS could not be reached to complete login.", 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return errorResponse("FYERS returned an invalid login response.", 502);
  }

  const accessToken =
    response.ok && isRecord(payload) && typeof payload.access_token === "string"
      ? payload.access_token.trim()
      : "";
  if (!accessToken) {
    return errorResponse("FYERS did not issue an access token.", 502);
  }

  const result = NextResponse.redirect(new URL("/", redirectUri));
  result.headers.set("Cache-Control", "no-store");
  result.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: 24 * 60 * 60,
  });
  result.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/fyers/callback",
    maxAge: 0,
  });
  return result;
}
