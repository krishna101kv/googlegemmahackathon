import fs from "fs";

const model = process.env.OLLAMA_MODEL ?? "gemma4:latest";

async function ask(label: string, path: string, content: string) {
  const images = [fs.readFileSync(path).toString("base64")];
  const started = Date.now();
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [{ role: "user", content, images }],
      options: { temperature: 0.1, num_predict: 256, num_ctx: 8192 },
    }),
  });
  const j = (await res.json()) as { message?: { content?: string } };
  console.log(`\n=== ${label} (${Date.now() - started}ms) ===`);
  console.log(String(j.message?.content ?? "(empty)").slice(0, 500));
}

async function main() {
  const user =
    "c:/Users/panki/Downloads/d066e6fa-9051-40c8-a3a6-a6975ea6723f.wav";
  const demo = "public/demo/sample-speech.wav";

  await ask(
    "demo EN ASR",
    demo,
    "Transcribe the following speech segment in English into English text. Only output the transcription, with no newlines.",
  );
  await ask(
    "user EN ASR",
    user,
    "Transcribe the following speech segment in English into English text. Only output the transcription, with no newlines.",
  );
  await ask(
    "user describe",
    user,
    "Listen carefully. Quote any English words you hear. If unintelligible, reply exactly: NO_SPEECH",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
