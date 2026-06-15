import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { ACENITE_URL } from "./constants";

export const BOOT_ID = randomUUID();

export interface HeartbeatOptions {
  apiKey: string;
  interval: number;
  fetchImpl?: typeof fetch;
}

export async function sendHeartbeat({
  apiKey,
  interval,
  fetchImpl = fetch,
}: HeartbeatOptions): Promise<void> {
  await sleep(Math.random() * (interval * 100));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      await fetchImpl(`${ACENITE_URL}/heartbeat/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
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

export function startHeartbeat(apiKey: string, interval: number): NodeJS.Timeout {
  const intervalMs = interval * 1000;
  const timer = setInterval(() => {
    void sendHeartbeat({ apiKey, interval });
  }, intervalMs);

  timer.unref?.();
  return timer;
}

