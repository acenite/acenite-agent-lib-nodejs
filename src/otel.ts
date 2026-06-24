import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import {
  ALLOWED_FRAMEWORKS,
  ALLOWED_INSTRUMENTATIONS,
  resolveAceniteUrl,
} from "./constants";
import type { AceniteAgentConfig } from "./types";

let provider: NodeTracerProvider | null = null;
let activeInstrumentations: Array<HttpInstrumentation | ExpressInstrumentation> = [];

export function setupOtel({
  framework,
  instrumentations,
  apiKey,
  serviceName,
  aceniteEnvironment = "production",
}: Required<
  Pick<AceniteAgentConfig, "apiKey" | "serviceName">
> &
  Pick<AceniteAgentConfig, "app" | "framework" | "instrumentations"> & {
    aceniteEnvironment?: "production" | "development";
  }): void {
  if (provider) {
    return;
  }

  if (framework) {
    if (!ALLOWED_FRAMEWORKS.has(framework)) {
      throw new Error(`Unsupported framework: ${framework}`);
    }

  }

  if (instrumentations) {
    for (const name of instrumentations) {
      if (!ALLOWED_INSTRUMENTATIONS.has(name)) {
        throw new Error(`Unsupported instrumentation: ${name}`);
      }
    }
  }

  provider = new NodeTracerProvider({
    resource: new Resource({
      "service.name": serviceName,
      "deployment.environment.name": aceniteEnvironment,
    }),
  });

  const exporter = new OTLPTraceExporter({
    url: `${resolveAceniteUrl()}/monitor/`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Acenite-Environment": aceniteEnvironment,
    },
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  const otelInstrumentations: Array<HttpInstrumentation | ExpressInstrumentation> = [];
  const includeHttp =
    framework === "express" || framework === "http" || instrumentations?.includes("http") === true;

  if (includeHttp) {
    otelInstrumentations.push(new HttpInstrumentation());
  }

  if (framework === "express") {
    otelInstrumentations.push(new ExpressInstrumentation());
  }

  if (otelInstrumentations.length > 0) {
    registerInstrumentations({
      tracerProvider: provider,
      instrumentations: otelInstrumentations,
    });
    activeInstrumentations = otelInstrumentations;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

export async function shutdownOtel(): Promise<void> {
  if (!provider) {
    return;
  }

  const activeProvider = provider;
  provider = null;
  for (const instrumentation of activeInstrumentations) {
    instrumentation.disable?.();
  }
  activeInstrumentations = [];
  await activeProvider.shutdown();
}

export function isOtelStarted(): boolean {
  return provider !== null;
}
