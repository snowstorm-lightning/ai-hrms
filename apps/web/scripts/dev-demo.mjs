import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["vite", "--host", "127.0.0.1", "--port", "5174", "--strictPort"], {
  env: { ...process.env, VITE_DEMO_MODE: "true" },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
