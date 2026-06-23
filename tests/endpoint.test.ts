import { describe, expect, it } from "vitest";

import { ACENITE_URL, resolveAceniteUrl } from "../src/constants";

describe("endpoint resolution", () => {
  it("uses production when no variables are present", () => {
    expect(resolveAceniteUrl({})).toBe(ACENITE_URL);
  });

  it("uses production when only the URL is present", () => {
    expect(resolveAceniteUrl({ ACENITE_AGENT_INGEST_URL: "http://127.0.0.1:5001" })).toBe(
      ACENITE_URL,
    );
  });

  it("uses production when only the allow flag is present", () => {
    expect(resolveAceniteUrl({ ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE: "TrUe" })).toBe(
      ACENITE_URL,
    );
  });

  it.each([
    "http://127.0.0.1:5001",
    "http://localhost:5001",
    "http://[::1]:5001",
  ])("uses the local override for %s", (url) => {
    expect(resolve(url)).toBe(url);
  });

  it.each(["http://example.com:5001", "https://example.com"])(
    "uses production for remote URL %s",
    (url) => {
      expect(resolve(url)).toBe(ACENITE_URL);
    },
  );
});

function resolve(url: string): string {
  return resolveAceniteUrl({
    ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE: "true",
    ACENITE_AGENT_INGEST_URL: url,
  });
}
