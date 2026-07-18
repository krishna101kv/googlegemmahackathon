import fs from "fs";
import path from "path";

const sampleRate = 16000;
const seconds = 2;
const numSamples = sampleRate * seconds;
const dataSize = numSamples * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const sample = Math.sin(2 * Math.PI * 440 * t) * 0.2 * Math.exp(-t * 1.5);
  buffer.writeInt16LE(
    Math.max(-1, Math.min(1, sample)) * 0x7fff,
    44 + i * 2,
  );
}

const out = path.join(process.cwd(), "data", "audio", "smoke-tone.wav");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buffer);

const base64 = buffer.toString("base64");
const model = process.env.OLLAMA_MODEL ?? "gemma4:latest";
const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

async function main() {
  console.log(`Calling ${model} with ${buffer.length} byte WAV…`);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [
        {
          role: "user",
          content: "Describe what you hear in one short sentence.",
          images: [base64],
        },
      ],
      options: { temperature: 0.2, num_ctx: 4096 },
    }),
  });

  if (!response.ok) {
    console.error(await response.text());
    process.exit(1);
  }

  const data = (await response.json()) as {
    message?: { content?: string };
  };
  console.log("Gemma response:", data.message?.content ?? "(empty)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
