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

    const resolvedAceniteUrl = resolveAceniteUrl();
    if (enableLogging && resolvedAceniteUrl !== ACENITE_URL) {
      console.info(
        `Acenite development endpoint override active: telemetry is being sent to ${resolvedAceniteUrl} instead of production.`,
      );
    }

    if (enableLogging) {
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
}
