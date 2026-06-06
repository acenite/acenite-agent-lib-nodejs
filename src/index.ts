export interface AceniteConfig {
  apiKey: string;
}

export function start(config: AceniteConfig): void {
  console.log("Acenite agent starting...");
  console.log("API Key:", config.apiKey);

  setInterval(() => {
    console.log("collecting metrics...");
  }, 5000);
}