import { afterEach, describe, expect, it, vi } from "vitest";

import { ACENITE_URL } from "../src/constants";
import { buildHostMetricsPayload, sendHostMetrics, type HostMetricsValues } from "../src/hostMetrics";

const metrics: HostMetricsValues = {
  cpu_percent: 10,
  memory_used_percent: 20,
  memory_used_bytes: 200,
  memory_total_bytes: 1000,
  disk_used_percent: 30,
  disk_used_bytes: 300,
  disk_total_bytes: 1000,
  network_rx_bytes: 400,
  network_tx_bytes: 500,
  load_average_1m: 1.2,
  host_uptime_seconds: 60,
};

describe("host metrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("builds a payload and defaults instanceId to hostname", async () => {
    const payload = await buildHostMetricsPayload({
      serviceName: "billing-api",
      hostname: "prod-api-1",
      collectMetrics: vi.fn().mockResolvedValue(metrics),
    });

    expect(payload.service_name).toBe("billing-api");
    expect(payload.hostname).toBe("prod-api-1");
    expect(payload.instance_id).toBe("prod-api-1");
    expect(payload.metrics.network_rx_bytes).toBe(400);
  });

  it("posts host metrics to the host endpoint", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));
    const promise = sendHostMetrics({
      apiKey: "test-key",
      serviceName: "billing-api",
      interval: 60,
      instanceId: "server-01",
      hostname: "prod-api-1",
      fetchImpl,
      collectMetrics: vi.fn().mockResolvedValue(metrics),
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(fetchImpl).toHaveBeenCalledWith(`${ACENITE_URL}/metrics/host`, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
        "X-Acenite-Environment": "production",
      },
      body: expect.stringContaining("\"network_rx_bytes\":400"),
      signal: expect.any(AbortSignal),
    });
  });

  it("swallows host metric request errors", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = sendHostMetrics({
      apiKey: "test-key",
      serviceName: "billing-api",
      interval: 60,
      fetchImpl: vi.fn().mockRejectedValue(new Error("network failed")),
      collectMetrics: vi.fn().mockResolvedValue(metrics),
    });

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("uses the local endpoint override", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubEnv("ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE", "true");
    vi.stubEnv("ACENITE_AGENT_INGEST_URL", "http://localhost:5001");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    const promise = sendHostMetrics({
      apiKey: "test-key",
      serviceName: "billing-api",
      interval: 60,
      fetchImpl,
      collectMetrics: vi.fn().mockResolvedValue(metrics),
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:5001/metrics/host");
  });
});
