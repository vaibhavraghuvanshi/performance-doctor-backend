import { createApp } from "./app";

const app = createApp();

const preferred = Number(process.env.PORT);
const startPort =
  Number.isFinite(preferred) && preferred > 0 ? preferred : 4000;
const maxAttempts = 15;

function listen(port: number, attempt: number): void {
  if (attempt > maxAttempts) {
    console.error(
      `Could not bind after ${maxAttempts} attempts (from port ${startPort}).`,
    );
    process.exit(1);
  }

  const server = app
    .listen(port, () => {
      const addr = server.address();
      const bound =
        typeof addr === "object" && addr !== null ? addr.port : port;
      console.log(`Server running on port ${bound}`);
      if (bound !== startPort) {
        console.warn(
          `(Port ${startPort} was in use; set PORT=${bound} in .env if the client expects a fixed port.)`,
        );
      }
    })
    .on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`Port ${port} is already in use, trying ${port + 1}…`);
        server.close(() => listen(port + 1, attempt + 1));
        return;
      }
      console.error(err);
      process.exit(1);
    });
}

listen(startPort, 1);
