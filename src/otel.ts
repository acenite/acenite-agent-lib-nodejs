import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import {
  ACENITE_URL,
  ALLOWED_FRAMEWORKS,
  ALLOWED_INSTRUMENTATIONS,
} from "./constants";
import type { AceniteAgentConfig } from "./types";

let provider: NodeTracerProvider | null = null;

export function setupOtel({
  app,
  framework,
  instrumentations,
  apiKey,
  serviceName,
}: Required<
  Pick<AceniteAgentConfig, "apiKey" | "serviceName">
> &
  Pick<AceniteAgentConfig, "app" | "framework" | "instrumentations">): void {
  if (provider) {
    return;
  }

  if (framework) {
    if (!ALLOWED_FRAMEWORKS.has(framework)) {
      throw new Error(`Unsupported framework: ${framework}`);
    }

    if (framework === "express" && app == null) {
      throw new Error("express framework requires app instance");
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
    resource: new Resource({ "service.name": serviceName }),
  });

  const exporter = new OTLPTraceExporter({
    url: `${ACENITE_URL}/monitor/`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  const otelInstrumentations = [];
  const includeHttp =
    framework === "express" || instrumentations?.includes("http") === true;

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
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

export async function shutdownOtel(): Promise<void> {
  if (!provider) {
    return;
  }

  const activeProvider = provider;
  provider = null;
  await activeProvider.shutdown();
}

export function isOtelStarted(): boolean {
  return provider !== null;
}

