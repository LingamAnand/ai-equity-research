import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGeminiFailure,
  createGeminiProviderError,
  GeminiProviderError,
} from "../lib/ai/gemini-errors.ts";
import { parseGeminiAnalysis } from "../lib/ai/gemini-response.ts";
import { withGeminiTransientRetries } from "../lib/ai/gemini-retry.ts";

const validAnalysis = JSON.stringify({
  executiveSummary: "Summary",
  businessQuality: "Quality",
  financialStrength: "Strength",
  growthDrivers: ["Growth"],
  keyRisks: ["Risk"],
  valuationObservation: "Observation",
  catalysts: ["Catalyst"],
  redFlags: ["Flag"],
  researchQuestions: ["Question"],
  dataLimitations: ["Limitation"],
});

test("Gemini retries transient 503 failures with exponential delays", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await withGeminiTransientRetries(
    async (timeoutMs) => {
      attempts += 1;
      assert.ok(timeoutMs > 0);
      if (attempts < 3) {
        throw Object.assign(new Error("Service unavailable"), { status: 503 });
      }
      return "success";
    },
    {
      timeoutMs: 10_000,
      baseDelayMs: 100,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    },
  );

  assert.equal(result, "success");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [100, 200]);
});

test("Gemini stops after the configured number of temporary retries", async () => {
  let attempts = 0;
  await assert.rejects(
    withGeminiTransientRetries(
      async () => {
        attempts += 1;
        throw Object.assign(new Error("UNAVAILABLE"), { status: 503 });
      },
      {
        timeoutMs: 10_000,
        maxRetries: 2,
        sleep: async () => undefined,
      },
    ),
    /UNAVAILABLE/,
  );
  assert.equal(attempts, 3);
});

test("Gemini does not retry rate limits or invalid responses", async () => {
  for (const error of [
    Object.assign(new Error("Rate limited"), { status: 429 }),
    new SyntaxError("invalid JSON"),
  ]) {
    let attempts = 0;
    await assert.rejects(
      withGeminiTransientRetries(
        async () => {
          attempts += 1;
          throw error;
        },
        {
          timeoutMs: 10_000,
          sleep: async () => undefined,
        },
      ),
    );
    assert.equal(attempts, 1);
  }
});

test("Gemini successfully parses a structured research analysis", () => {
  assert.equal(
    parseGeminiAnalysis(validAnalysis).executiveSummary,
    "Summary",
  );
});

test("Gemini response parsing distinguishes malformed JSON", () => {
  assert.throws(
    () => parseGeminiAnalysis("not-json"),
    (error: unknown) =>
      error instanceof GeminiProviderError &&
      error.failure === "invalid_response",
  );
});

test("Gemini failure classification leaves temporary 503 as unavailable", () => {
  assert.equal(
    classifyGeminiFailure(
      Object.assign(new Error("Service unavailable"), { status: 503 }),
    ),
    "unavailable",
  );
});

test("exhausted Gemini 503 retries produce the structured provider error", async () => {
  let attempts = 0;
  await assert.rejects(
    withGeminiTransientRetries(async () => {
      attempts += 1;
      throw Object.assign(new Error("UNAVAILABLE"), { status: 503 });
    }, {
      timeoutMs: 10_000,
      sleep: async () => undefined,
    }),
    (error: unknown) => {
      const structuredError = createGeminiProviderError(error);
      return (
        structuredError instanceof GeminiProviderError &&
        structuredError.failure === "unavailable" &&
        structuredError.message ===
          "AI analysis is temporarily unavailable. Please try again."
      );
    },
  );
  assert.equal(attempts, 3);
});

test("Gemini error mapping keeps rate limits and invalid JSON distinct", () => {
  assert.equal(
    createGeminiProviderError(
      Object.assign(new Error("Rate limited"), { status: 429 }),
    ).failure,
    "rate_limited",
  );
  assert.equal(
    createGeminiProviderError(new SyntaxError("invalid JSON")).failure,
    "invalid_response",
  );
});
