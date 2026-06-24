import { spawn } from "node:child_process";

const commands = [
  { name: "ws", args: ["run", "ws"] },
  { name: "next", args: ["run", "next"] }
];

function normalizedEnv() {
  const env = { ...process.env };
  if (process.platform === "win32") {
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path");
    const pathValue = pathKey ? env[pathKey] : undefined;
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === "path" && key !== "Path") delete env[key];
    }
    if (pathValue) env.Path = pathValue;
  }
  env.NEXT_PUBLIC_APP_URL = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  env.NEXT_PUBLIC_WS_URL = env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
  return env;
}

const children = commands.map(({ name, args }) => {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    env: normalizedEnv()
  });
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  console.log(`[Punktlandung] ${name} gestartet`);
  return child;
});

function shutdown() {
  for (const child of children) child.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
