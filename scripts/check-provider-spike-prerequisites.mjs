import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function command(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 10_000 });
  return {
    available: !result.error && result.status === 0,
    detail: result.error?.code === "ENOENT" ? "nicht installiert" : result.status === 0 ? "bereit" : "nicht betriebsbereit"
  };
}

const localBin = (name) => resolve(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
const docker = command("docker", ["version", "--format", "{{.Server.Version}}"]);
const java = command("java", ["-version"]);
const supabaseCli = existsSync(localBin("supabase"))
  ? command(localBin("supabase"), ["--version"])
  : { available: false, detail: "nicht lokal installiert" };
const firebaseCli = existsSync(localBin("firebase"))
  ? command(localBin("firebase"), ["--version"])
  : { available: false, detail: "nicht lokal installiert" };

const rows = [
  { Voraussetzung: "Docker-Dienst", Status: docker.detail, BenoetigtFuer: "lokales Supabase" },
  { Voraussetzung: "Supabase CLI", Status: supabaseCli.detail, BenoetigtFuer: "lokales Supabase" },
  { Voraussetzung: "Java Runtime", Status: java.detail, BenoetigtFuer: "Firebase Emulator" },
  { Voraussetzung: "Firebase CLI", Status: firebaseCli.detail, BenoetigtFuer: "Firebase Emulator" }
];

console.table(rows);
const ready = docker.available && supabaseCli.available && java.available && firebaseCli.available;
if (!ready) {
  console.error("Provider-Spike ist lokal noch nicht ausfuehrbar. Keine Produktionszugangsdaten wurden geprueft oder ausgegeben.");
  process.exitCode = 2;
} else {
  console.log("Provider-Spike-Voraussetzungen sind lokal bereit.");
}
