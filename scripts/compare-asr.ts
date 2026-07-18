import fs from "fs";

const model = process.env.OLLAMA_MODEL ?? "gemma4:latest";

async function transcribe(label: string, path: string) {
  const b = fs.readFileSync(path).toString("base64");
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [
        {
          role: "user",
          content:
            "Transcribe the following speech segment in its original language. Only output the transcription, with no newlines.",
          images: [b],
        },
      ],
      options: { temperature: 0.1, num_predict: 512, num_ctx: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`${label}: ${await res.text()}`);
  const j = (await res.json()) as { message?: { content?: string } };
  console.log(`--- ${label} ---`);
  console.log(j.message?.content ?? "(empty)");
}

async function main() {
  await transcribe(
    "original",
    "c:/Users/panki/Downloads/d066e6fa-9051-40c8-a3a6-a6975ea6723f.wav",
  );
  if (fs.existsSync("data/audio/user-amplified.wav")) {
    await transcribe("amplified", "data/audio/user-amplified.wav");
  }
  await transcribe("cookbook", "public/demo/sample-speech.wav");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
