import { spawnSync } from "node:child_process";

const commands =
  process.platform === "win32"
    ? [
        ["powershell", ["-ExecutionPolicy", "Bypass", "-File", "harness/check.ps1"]],
        ["pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "harness/check.ps1"]],
      ]
    : [["bash", ["harness/check.sh"]]];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error?.code === "ENOENT") {
    continue;
  }
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

console.error("No supported shell was found for the project harness.");
process.exit(1);
