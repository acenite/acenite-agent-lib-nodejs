import { afterEach, describe, expect, it, vi } from "vitest";

import { ACENITE_URL } from "../src/constants";
import { BOOT_ID, sendHeartbeat } from "../src/heartbeat";

describe("sendHeartbeat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("posts the Python-compatible heartbeat payload", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));
    const promise = sendHeartbeat({
      apiKey: "test-key",
      interval: 60,
      fetchImpl,
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(fetchImpl).toHaveBeenCalledWith(`${ACENITE_URL}/heartbeat/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
        "X-Acenite-Environment": "production",
      },
      body: JSON.stringify({
        status: "up",
        boot_id: BOOT_ID,
        instance_id: "default",
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it("swallows heartbeat request errors", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = sendHeartbeat({
      apiKey: "test-key",
      interval: 60,
      fetchImpl: vi.fn().mockRejectedValue(new Error("network failed")),
    });

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("uses the local endpoint override", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubEnv("ACENITE_AGENT_ALLOW_ENDPOINT_OVERRIDE", "true");
    vi.stubEnv("ACENITE_AGENT_INGEST_URL", "http://127.0.0.1:5001");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    const promise = sendHeartbeat({ apiKey: "test-key", interval: 60, fetchImpl });
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchImpl.mock.calls[0][0]).toBe("http://127.0.0.1:5001/heartbeat/");
  });
});
