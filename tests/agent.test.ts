import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/heartbeat", () => ({
  startHeartbeat: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock("../src/otel", () => ({
  setupOtel: vi.fn(),
  shutdownOtel: vi.fn().mockResolvedValue(undefined),
}));

import { AceniteAgent, start, stop } from "../src";
import { startHeartbeat } from "../src/heartbeat";
import { setupOtel } from "../src/otel";

describe("AceniteAgent", () => {
  afterEach(async () => {
    await AceniteAgent.stop();
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
    });
    expect(startHeartbeat).toHaveBeenCalledOnce();
    expect(startHeartbeat).toHaveBeenCalledWith("test-key", 60);
  });

  it("honors disabled logging and heartbeat options", () => {
    AceniteAgent.start({
      apiKey: "test-key",
      enableLogging: false,
      enableHeartbeat: false,
    });

    expect(setupOtel).not.toHaveBeenCalled();
    expect(startHeartbeat).not.toHaveBeenCalled();
  });

  it("uses the Python-compatible default service name and custom interval", () => {
    AceniteAgent.start({
      apiKey: "test-key",
      heartbeatInterval: 15,
    });

    expect(setupOtel).toHaveBeenCalledWith({
      app: null,
      framework: undefined,
      instrumentations: undefined,
      apiKey: "test-key",
      serviceName: "unknown-service",
    });
    expect(startHeartbeat).toHaveBeenCalledWith("test-key", 15);
  });

  it("exports start and stop convenience functions", async () => {
    start({ apiKey: "test-key" });
    await stop();

    expect(setupOtel).toHaveBeenCalledOnce();
  });
});

