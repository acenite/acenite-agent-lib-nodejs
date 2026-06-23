import { isIP } from "node:net";

export const ACENITE_URL = "https://ingest.acenite.com";
export const ALLOW_ENDPOINT_OVERRIDE_ENV = "ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE";
export const INGEST_URL_ENV = "ACENITE_AGENT_INGEST_URL";

export function resolveAceniteUrl(environment: NodeJS.ProcessEnv = process.env): string {
  if (environment[ALLOW_ENDPOINT_OVERRIDE_ENV]?.toLowerCase() !== "true") {
    return ACENITE_URL;
  }

  const candidate = environment[INGEST_URL_ENV];
  if (!candidate || candidate.trim() !== candidate) {
    return ACENITE_URL;
  }

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return ACENITE_URL;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (hostname === "localhost") {
      return candidate;
    }

    const addressFamily = isIP(hostname);
    if (addressFamily === 4 && hostname.split(".")[0] === "127") {
      return candidate;
    }
    if (addressFamily === 6 && hostname === "::1") {
      return candidate;
    }
  } catch {
    return ACENITE_URL;
  }

  return ACENITE_URL;
}

export const ALLOWED_FRAMEWORKS = new Set(["express"]);
export const ALLOWED_INSTRUMENTATIONS = new Set(["http"]);

