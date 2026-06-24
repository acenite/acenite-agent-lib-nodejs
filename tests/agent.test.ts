import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/heartbeat", () => ({
  startHeartbeat: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock("../src/hostMetrics", () => ({
  startHostMetrics: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock("../src/otel", () => ({
  setupOtel: vi.fn(),
  shutdownOtel: vi.fn().mockResolvedValue(undefined),
}));

import { AceniteAgent, start, stop } from "../src";
import { startHeartbeat } from "../src/heartbeat";
import { startHostMetrics } from "../src/hostMetrics";
import { setupOtel } from "../src/otel";

describe("AceniteAgent", () => {
  beforeEach(() => vi.stubEnv("ACENITE_ENVIRONMENT", "production"));
  afterEach(async () => {
    await AceniteAgent.stop();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("starts logging and heartbeat once", () => {
    AceniteAgent.start({
      apiKey: "test-key",
      serviceName: "orders",
      framework: "express",
      app: {},
      instrumentations: ["http"],
    });
    AceniteAgent.start({
      apiKey: "test-key",
      serviceName: "orders",
      framework: "express",
      app: {},
    });

    expect(setupOtel).toHaveBeenCalledOnce();
    expect(setupOtel).toHaveBeenCalledWith({
      app: {},
      framework: "express",
      instrumentations: ["http"],
      apiKey: "test-key",
      serviceName: "orders",
      aceniteEnvironment: "production",
    });
    expect(startHeartbeat).toHaveBeenCalledOnce();
    expect(startHeartbeat).toHaveBeenCalledWith("test-key", 60, "production");
    expect(startHostMetrics).toHaveBeenCalledOnce();
    expect(startHostMetrics).toHaveBeenCalledWith({
      apiKey: "test-key",
      serviceName: "orders",
      interval: 60,
      instanceId: undefined,
      hostname: undefined,
      aceniteEnvironment: "production",
    });
  });

  it("honors disabled logging, heartbeat, and host metrics options", () => {
    AceniteAgent.start({
      apiKey: "test-key",
      enableLogging: false,
      enableHeartbeat: false,
      enableHostMetrics: false,
    });

    expect(setupOtel).not.toHaveBeenCalled();
    expect(startHeartbeat).not.toHaveBeenCalled();
    expect(startHostMetrics).not.toHaveBeenCalled();
  });

  it("canonical application monitoring can be disabled independently of logging", () => {
    AceniteAgent.start({
      apiKey: "test-key",
      framework: "http",
      enableLogging: true,
      enableApplicationMonitoring: false,
      enableHeartbeat: false,
      enableHostMetrics: false,
    });
    expect(setupOtel).not.toHaveBeenCalled();
  });

  it("validates canonical framework and interval ranges", () => {
    expect(() => AceniteAgent.start({ apiKey: "test-key", framework: "fastify" as never })).toThrow("Unsupported framework");
    expect(() => AceniteAgent.start({ apiKey: "test-key", heartbeatInterval: 14 })).toThrow("between 15 and 300");
  });

  it("uses the Python-compatible default service name and custom intervals", () => {
    AceniteAgent.start({
      apiKey: "test-key",
      heartbeatInterval: 15,
      hostMetricsInterval: 30,
      instanceId: "server-01",
      hostname: "prod-api-1",
    });

    expect(setupOtel).toHaveBeenCalledWith({
      app: null,
      framework: undefined,
      instrumentations: undefined,
      apiKey: "test-key",
      serviceName: "unknown-service",
      aceniteEnvironment: "production",
    });
    expect(startHeartbeat).toHaveBeenCalledWith("test-key", 15, "production");
    expect(startHostMetrics).toHaveBeenCalledWith({
      apiKey: "test-key",
      serviceName: "unknown-service",
      interval: 30,
      instanceId: "server-01",
      hostname: "prod-api-1",
      aceniteEnvironment: "production",
    });
  });

  it("exports start and stop convenience functions", async () => {
    start({ apiKey: "test-key" });
    await stop();

    expect(setupOtel).toHaveBeenCalledOnce();
  });

  it("logs the local endpoint override once when logging is enabled", () => {
    vi.stubEnv("ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE", "TRUE");
    vi.stubEnv("ACENITE_AGENT_INGEST_URL", "http://127.0.0.1:5001");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    AceniteAgent.start({ apiKey: "test-key" });
    AceniteAgent.start({ apiKey: "test-key" });

    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("instead of production"));
  });

  it("runs only instrumentation in development", () => {
    vi.stubEnv("ACENITE_ENVIRONMENT", "development");
    AceniteAgent.start({ apiKey: "test-key" });
    expect(setupOtel).toHaveBeenCalledWith(expect.objectContaining({ aceniteEnvironment: "development" }));
    expect(startHeartbeat).not.toHaveBeenCalled();
    expect(startHostMetrics).not.toHaveBeenCalled();
  });

  it("defaults missing environment to production with one documented warning", () => {
    vi.unstubAllEnvs();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    AceniteAgent.start({ apiKey: "test-key", enableHeartbeat: false, enableHostMetrics: false });
    AceniteAgent.start({ apiKey: "test-key" });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("https://acenite.com/docs/environments");
  });

  it("rejects empty and invalid environments before startup", () => {
    for (const value of ["", "Production", " development ", "staging"]) {
      vi.stubEnv("ACENITE_ENVIRONMENT", value);
      expect(() => AceniteAgent.start({ apiKey: "test-key" })).toThrow("ACENITE_ENVIRONMENT");
    }
    expect(setupOtel).not.toHaveBeenCalled();
  });
});
