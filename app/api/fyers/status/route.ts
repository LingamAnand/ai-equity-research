import { cookies } from "next/headers";
import { getFyersStatus, resolveFyersToken } from "@/lib/services/fyers-token";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const tokenResolution = resolveFyersToken(
    cookieStore.get("fyers_access_token")?.value,
    process.env.FYERS_ACCESS_TOKEN,
  );

  console.info("[fyers] Access token resolved", {
    tokenSource: tokenResolution.tokenSource,
    tokenPresent: tokenResolution.tokenPresent,
  });

  return Response.json(getFyersStatus(process.env, tokenResolution), {
    headers: { "Cache-Control": "no-store" },
  });
}
