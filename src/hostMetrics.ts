import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statfsSync } from "node:fs";
import { homedir } from "node:os";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { resolveAceniteUrl } from "./constants";

export const HOST_METRICS_BOOT_ID = randomUUID();

export interface HostMetricsOptions {
  apiKey: string;
  serviceName: string;
  interval: number;
  instanceId?: string;
  hostname?: string;
  fetchImpl?: typeof fetch;
  collectMetrics?: typeof collectHostMetrics;
  jitter?: boolean;
  aceniteEnvironment?: "production" | "development";
}

export interface HostMetricsPayload {
  service_name: string;
  instance_id: string;
  hostname: string;
  timestamp: string;
  metrics: HostMetricsValues;
}

export interface HostMetricsValues {
  cpu_percent: number;
  memory_used_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  disk_used_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  load_average_1m: number;
  host_uptime_seconds: number;
}

export async function sendHostMetrics({
  apiKey,
  serviceName,
  interval,
  instanceId,
  hostname,
  fetchImpl = fetch,
  collectMetrics = collectHostMetrics,
  jitter = true,
  aceniteEnvironment = "production",
}: HostMetricsOptions): Promise<void> {
  if (jitter) await sleep(Math.random() * (interval * 100));

  try {
    const payload = await buildHostMetricsPayload({
      serviceName,
      instanceId,
      hostname,
      collectMetrics,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      await fetchImpl(`${resolveAceniteUrl()}/metrics/host`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Acenite-Environment": aceniteEnvironment,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(error);
  }
}

export function startHostMetrics({
  apiKey,
  serviceName,
  interval,
  instanceId,
  hostname,
  aceniteEnvironment = "production",
}: Omit<HostMetricsOptions, "fetchImpl" | "collectMetrics">): NodeJS.Timeout {
  void sendHostMetrics({
    apiKey,
    serviceName,
    interval,
    instanceId,
    hostname,
    jitter: false,
    aceniteEnvironment,
  });
  const intervalMs = interval * 1000;
  const timer = setInterval(() => {
    void sendHostMetrics({
      apiKey,
      serviceName,
      interval,
      instanceId,
      hostname,
      aceniteEnvironment,
    });
  }, intervalMs);

  timer.unref?.();
  return timer;
}

export async function buildHostMetricsPayload({
  serviceName,
  instanceId,
  hostname,
  collectMetrics = collectHostMetrics,
}: Pick<HostMetricsOptions, "serviceName" | "instanceId" | "hostname" | "collectMetrics">): Promise<HostMetricsPayload> {
  const resolvedHostname = (hostname ?? os.hostname() ?? "unknown-host").trim() || "unknown-host";
  const resolvedInstanceId = (instanceId ?? resolvedHostname).trim() || resolvedHostname;

  return {
    service_name: serviceName,
    instance_id: resolvedInstanceId,
    hostname: resolvedHostname,
    timestamp: new Date().toISOString(),
    metrics: await collectMetrics(),
  };
}

export async function collectHostMetrics(): Promise<HostMetricsValues> {
  const [cpuPercent, disk, network] = await Promise.all([
    sampleCpuPercent(),
    Promise.resolve(readDiskUsage()),
    Promise.resolve(readNetworkCounters()),
  ]);
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = Math.max(0, totalMemory - freeMemory);

  return {
    cpu_percent: cpuPercent,
    memory_used_percent: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0,
    memory_used_bytes: usedMemory,
    memory_total_bytes: totalMemory,
    disk_used_percent: disk.total > 0 ? (disk.used / disk.total) * 100 : 0,
    disk_used_bytes: disk.used,
    disk_total_bytes: disk.total,
    // Cumulative counters. The Acenite backend calculates deltas/rates.
    network_rx_bytes: network.rx,
    network_tx_bytes: network.tx,
    load_average_1m: Math.max(0, os.loadavg()[0] ?? 0),
    host_uptime_seconds: Math.floor(os.uptime()),
  };
}

async function sampleCpuPercent(): Promise<number> {
  const start = cpuSnapshot();
  await sleep(100);
  const end = cpuSnapshot();
  const idle = end.idle - start.idle;
  const total = end.total - start.total;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idle / total) * 100));
}

function cpuSnapshot(): { idle: number; total: number } {
  return os.cpus().reduce(
    (acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      return {
        idle: acc.idle + cpu.times.idle,
        total: acc.total + total,
      };
    },
    { idle: 0, total: 0 },
  );
}

function readDiskUsage(): { used: number; total: number } {
  const root = path.parse(homedir()).root || "/";
  const stats = statfsSync(root);
  const total = Number(stats.blocks) * Number(stats.bsize);
  const free = Number(stats.bavail) * Number(stats.bsize);
  return {
    used: Math.max(0, total - free),
    total,
  };
}

function readNetworkCounters(): { rx: number; tx: number } {
  if (!existsSync("/proc/net/dev")) {
    return { rx: 0, tx: 0 };
  }

  const content = readFileSync("/proc/net/dev", "utf8");
  return content
    .split("\n")
    .slice(2)
    .reduce(
      (acc, line) => {
        const [namePart, dataPart] = line.split(":");
        if (!namePart || !dataPart) return acc;
        const name = namePart.trim();
        if (name === "lo") return acc;
        const fields = dataPart.trim().split(/\s+/).map(Number);
        if (fields.length < 16) return acc;
        return {
          rx: acc.rx + (Number.isFinite(fields[0]) ? fields[0] : 0),
          tx: acc.tx + (Number.isFinite(fields[8]) ? fields[8] : 0),
        };
      },
      { rx: 0, tx: 0 },
    );
}
