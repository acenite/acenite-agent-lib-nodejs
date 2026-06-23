import { trace, type Tracer } from "@opentelemetry/api";

import { ACENITE_URL, resolveAceniteUrl } from "./constants";
import { startHeartbeat } from "./heartbeat";
import { startHostMetrics } from "./hostMetrics";
import { setupOtel, shutdownOtel } from "./otel";
import type { AceniteAgentConfig } from "./types";

export class AceniteAgent {
  private static started = false;
  private static heartbeatTimer: NodeJS.Timeout | null = null;
  private static hostMetricsTimer: NodeJS.Timeout | null = null;
  private static shutdownHooksRegistered = false;

  static start({
    app = null,
    framework,
    instrumentations = undefined,
    apiKey,
    serviceName = "unknown-service",
    enableLogging = true,
    enableApplicationMonitoring,
    enableHeartbeat = true,
    heartbeatInterval = 60,
    enableHostMetrics = true,
    hostMetricsInterval = 60,
    instanceId,
    hostname,
  }: AceniteAgentConfig): void {
    if (AceniteAgent.started) {
      return;
    }

    if (!apiKey?.trim()) throw new Error("apiKey is required");
    if (!serviceName.trim()) throw new Error("serviceName must not be blank");
    AceniteAgent.validateInterval("heartbeatInterval", heartbeatInterval);
    AceniteAgent.validateInterval("hostMetricsInterval", hostMetricsInterval);
    if (framework && framework !== "express" && framework !== "http") {
      throw new Error(`Unsupported framework: ${framework}`);
    }

    // enableLogging historically controlled OpenTelemetry. Keep that behavior
    // unless the canonical application-monitoring flag is explicitly supplied.
    const applicationMonitoring = enableApplicationMonitoring ?? enableLogging;

    const resolvedAceniteUrl = resolveAceniteUrl();
    if (enableLogging && resolvedAceniteUrl !== ACENITE_URL) {
      console.info(
        `Acenite development endpoint override active: telemetry is being sent to ${resolvedAceniteUrl} instead of production.`,
      );
    }

    if (applicationMonitoring) {
      setupOtel({
        app,
        framework,
        instrumentations,
        apiKey,
        serviceName,
      });
    }

    if (enableHeartbeat) {
      AceniteAgent.heartbeatTimer = startHeartbeat(apiKey, heartbeatInterval);
    }

    if (enableHostMetrics) {
      AceniteAgent.hostMetricsTimer = startHostMetrics({
        apiKey,
        serviceName,
        interval: hostMetricsInterval,
        instanceId,
        hostname,
      });
    }

    AceniteAgent.started = true;
    AceniteAgent.registerShutdownHooks();
  }

  static getTracer(): Tracer {
    return trace.getTracer("acenite-agent");
  }

  static async stop(): Promise<void> {
    if (AceniteAgent.heartbeatTimer) {
      clearInterval(AceniteAgent.heartbeatTimer);
      AceniteAgent.heartbeatTimer = null;
    }
    if (AceniteAgent.hostMetricsTimer) {
      clearInterval(AceniteAgent.hostMetricsTimer);
      AceniteAgent.hostMetricsTimer = null;
    }

    await shutdownOtel();
    AceniteAgent.started = false;
  }

  private static registerShutdownHooks(): void {
    if (AceniteAgent.shutdownHooksRegistered) {
      return;
    }

    const shutdown = () => {
      void AceniteAgent.stop();
    };

    process.once("beforeExit", shutdown);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    AceniteAgent.shutdownHooksRegistered = true;
  }

  private static validateInterval(name: string, value: number): void {
    if (!Number.isFinite(value) || value < 15 || value > 300) {
      throw new Error(`${name} must be between 15 and 300 seconds`);
    }
  }
}
