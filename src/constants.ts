import { isIP } from "node:net";

export const ACENITE_URL = "https://ingest.acenite.com";
export const ALLOW_ENDPOINT_OVERRIDE_ENV = "ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE";
export const INGEST_URL_ENV = "ACENITE_AGENT_INGEST_URL";
export const ACENITE_ENVIRONMENT_ENV = "ACENITE_ENVIRONMENT";
export const ACENITE_ENVIRONMENT_DOCS_URL = "https://acenite.com/docs/environments";

export function resolveAceniteEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): { value: "production" | "development"; defaulted: boolean } {
  if (!(ACENITE_ENVIRONMENT_ENV in environment)) {
    return { value: "production", defaulted: true };
  }
  const value = environment[ACENITE_ENVIRONMENT_ENV];
  if (value !== "production" && value !== "development") {
    throw new Error(
      `ACENITE_ENVIRONMENT must be exactly 'production' or 'development'; see ${ACENITE_ENVIRONMENT_DOCS_URL}`,
    );
  }
  return { value, defaulted: false };
}

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

export const ALLOWED_FRAMEWORKS = new Set(["express", "http"]);
export const ALLOWED_INSTRUMENTATIONS = new Set(["http"]);
