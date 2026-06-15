import { trace, type Tracer } from "@opentelemetry/api";

import { startHeartbeat } from "./heartbeat";
import { setupOtel, shutdownOtel } from "./otel";
import type { AceniteAgentConfig } from "./types";

export class AceniteAgent {
  private static started = false;
  private static heartbeatTimer: NodeJS.Timeout | null = null;
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
  }: AceniteAgentConfig): void {
    if (AceniteAgent.started) {
      return;
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

