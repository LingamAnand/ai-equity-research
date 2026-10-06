import type { MarketDataProviderConfiguration } from "./market-data-provider-selection.ts";
import { resolveMarketDataProviderConfiguration } from "./market-data-provider-selection.ts";

export type FyersTokenSource = "cookie" | "environment" | "none";

export interface FyersTokenResolution {
  accessToken: string;
  tokenSource: FyersTokenSource;
  tokenPresent: boolean;
}

export function resolveFyersToken(
  cookieToken: string | undefined,
  environmentToken: string | undefined,
): FyersTokenResolution {
  const cookieValue = cookieToken?.trim();
  if (cookieValue) {
    return {
      accessToken: cookieValue,
      tokenSource: "cookie",
      tokenPresent: true,
    };
  }

  const environmentValue = environmentToken?.trim();
  if (environmentValue) {
    return {
      accessToken: environmentValue,
      tokenSource: "environment",
      tokenPresent: true,
    };
  }

  return { accessToken: "", tokenSource: "none", tokenPresent: false };
}

export interface FyersStatus {
  provider: "fyers";
  configured: boolean;
  tokenSource: FyersTokenSource;
  tokenPresent: boolean;
  clientIdConfigured: boolean;
}

export function getFyersStatus(
  environment: Record<string, string | undefined>,
  tokenResolution: FyersTokenResolution,
): FyersStatus {
  const configuredEnvironment = {
    ...environment,
    FYERS_ACCESS_TOKEN: tokenResolution.accessToken,
  };
  const configuration: MarketDataProviderConfiguration =
    resolveMarketDataProviderConfiguration(configuredEnvironment);

  return {
    provider: "fyers",
    configured:
      configuration.providerId === "fyers" && configuration.failure === null,
    tokenSource: tokenResolution.tokenSource,
    tokenPresent: tokenResolution.tokenPresent,
    clientIdConfigured: Boolean(environment.FYERS_CLIENT_ID?.trim()),
  };
}
