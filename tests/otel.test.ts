import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addSpanProcessor: vi.fn(),
  register: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
  registerInstrumentations: vi.fn(),
}));

vi.mock("@opentelemetry/api", () => ({
  diag: { setLogger: vi.fn() },
  DiagConsoleLogger: vi.fn(),
  DiagLogLevel: { ERROR: 30 },
}));

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: vi.fn(function OTLPTraceExporter() {}),
}));

vi.mock("@opentelemetry/instrumentation", () => ({
  registerInstrumentations: mocks.registerInstrumentations,
}));

vi.mock("@opentelemetry/instrumentation-express", () => ({
  ExpressInstrumentation: vi.fn(function ExpressInstrumentation() {}),
}));

vi.mock("@opentelemetry/instrumentation-http", () => ({
  HttpInstrumentation: vi.fn(function HttpInstrumentation() {}),
}));

vi.mock("@opentelemetry/resources", () => ({
  Resource: vi.fn(function Resource() {}),
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
  BatchSpanProcessor: vi.fn(function BatchSpanProcessor() {}),
}));

vi.mock("@opentelemetry/sdk-trace-node", () => ({
  NodeTracerProvider: vi.fn(function NodeTracerProvider() {
    return {
      addSpanProcessor: mocks.addSpanProcessor,
      register: mocks.register,
      shutdown: mocks.shutdown,
    };
  }),
}));

import { setupOtel, shutdownOtel } from "../src/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

describe("setupOtel", () => {
  afterEach(async () => {
    await shutdownOtel();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects unsupported frameworks", () => {
    expect(() =>
      setupOtel({
        apiKey: "test-key",
        serviceName: "orders",
        framework: "fastify" as never,
      }),
    ).toThrow("Unsupported framework: fastify");
  });

  it("allows express instrumentation to bootstrap before express is imported", () => {
    expect(() => setupOtel({
      apiKey: "test-key",
      serviceName: "orders",
      framework: "express",
      app: null,
    })).not.toThrow();
  });

  it("rejects unsupported instrumentations", () => {
    expect(() =>
      setupOtel({
        apiKey: "test-key",
        serviceName: "orders",
        instrumentations: ["mysql" as never],
      }),
    ).toThrow("Unsupported instrumentation: mysql");
  });

  it("registers OpenTelemetry for express", () => {
    setupOtel({
      apiKey: "test-key",
      serviceName: "orders",
      framework: "express",
      app: {},
    });

    expect(mocks.addSpanProcessor).toHaveBeenCalledOnce();
    expect(mocks.register).toHaveBeenCalledOnce();
    expect(mocks.registerInstrumentations).toHaveBeenCalledOnce();
  });

  it("registers built-in HTTP instrumentation from the canonical framework", () => {
    setupOtel({ apiKey: "test-key", serviceName: "orders", framework: "http" });
    expect(mocks.registerInstrumentations).toHaveBeenCalledOnce();
  });

  it("uses the local endpoint override for OTLP", () => {
    vi.stubEnv("ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE", "true");
    vi.stubEnv("ACENITE_AGENT_INGEST_URL", "http://[::1]:5001");

    setupOtel({ apiKey: "test-key", serviceName: "orders" });

    expect(OTLPTraceExporter).toHaveBeenCalledWith({
      url: "http://[::1]:5001/monitor/",
      headers: {
        Authorization: "Bearer test-key",
        "X-Acenite-Environment": "production",
      },
    });
  });
});
