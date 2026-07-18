import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const publicDir = path.join(process.cwd(), "public", "demo");
const dataAudio = path.join(process.cwd(), "data", "audio");
const target = path.join(publicDir, "sample-speech.wav");

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(dataAudio, { recursive: true });

async function downloadCookbookSample(): Promise<boolean> {
  const url =
    "https://raw.githubusercontent.com/google-gemma/cookbook/refs/heads/main/apps/sample-data/journal1.wav";
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
    console.log("Downloaded Gemma cookbook journal1.wav ->", target);
    return true;
  } catch {
    return false;
  }
}

function makeWindowsTts(): boolean {
  const ps1 = path.join(process.cwd(), "scripts", "make-demo-speech.ps1");
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    return false;
  }

  const raw = path.join(dataAudio, "demo-speech-raw.wav");
  if (!fs.existsSync(raw)) return false;

  // Convert to 16k mono via a tiny pure-JS resample if needed.
  // For demo reliability, copy raw if already usable; browser will re-normalize.
  fs.copyFileSync(raw, target);
  console.log("Created Windows TTS demo sample ->", target);
  return true;
}

async function main() {
  if (await downloadCookbookSample()) return;
  if (makeWindowsTts()) return;
  throw new Error("Could not prepare demo sample audio.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
