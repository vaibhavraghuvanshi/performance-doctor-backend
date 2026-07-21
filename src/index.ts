import type { Server } from "http";
import { createApp } from "./app";
import { validateEnvironment } from "./config";
import { closeDatabase, initializeDatabase } from "./db";

function configuredPort(): number {
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await closeDatabase();
  clearTimeout(forceExit);
}

async function start(): Promise<void> {
  validateEnvironment();
  await initializeDatabase();

  const port = configuredPort();
  server = createApp().listen(port);
  await new Promise<void>((resolve, reject) => {
    server!.once("listening", resolve);
    server!.once("error", reject);
  });
  console.log(`Server running on port ${port}`);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Shutdown failed", error);
        process.exit(1);
      });
  });
}

void start().catch(async (error) => {
  console.error("Server failed to start", error);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
