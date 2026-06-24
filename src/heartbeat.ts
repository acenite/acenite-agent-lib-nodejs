import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { resolveAceniteUrl } from "./constants";

export const BOOT_ID = randomUUID();

export interface HeartbeatOptions {
  apiKey: string;
  interval: number;
  fetchImpl?: typeof fetch;
  jitter?: boolean;
  aceniteEnvironment?: "production" | "development";
}

export async function sendHeartbeat({
  apiKey,
  interval,
  fetchImpl = fetch,
  jitter = true,
  aceniteEnvironment = "production",
}: HeartbeatOptions): Promise<void> {
  if (jitter) await sleep(Math.random() * (interval * 100));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      await fetchImpl(`${resolveAceniteUrl()}/heartbeat/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Acenite-Environment": aceniteEnvironment,
        },
        body: JSON.stringify({
          status: "up",
          boot_id: BOOT_ID,
          instance_id: "default",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(error);
  }
}

export function startHeartbeat(
  apiKey: string,
  interval: number,
  aceniteEnvironment: "production" | "development" = "production",
): NodeJS.Timeout {
  void sendHeartbeat({ apiKey, interval, jitter: false, aceniteEnvironment });
  const intervalMs = interval * 1000;
  const timer = setInterval(() => {
    void sendHeartbeat({ apiKey, interval, aceniteEnvironment });
  }, intervalMs);

  timer.unref?.();
  return timer;
}
