import fs from "fs";

const src =
  process.argv[2] ??
  "c:/Users/panki/Downloads/d066e6fa-9051-40c8-a3a6-a6975ea6723f.wav";
const dest = process.argv[3] ?? "data/audio/user-amplified.wav";

const b = fs.readFileSync(src);
const dataStart = 44;
const samples = (b.length - dataStart) / 2;
let peak = 0;
for (let i = 0; i < samples; i++) {
  peak = Math.max(peak, Math.abs(b.readInt16LE(dataStart + i * 2)));
}
const gain = Math.min(10, Math.floor(30000 / Math.max(peak, 1)));
console.log({ peak, gain, samples });

const out = Buffer.from(b);
for (let i = 0; i < samples; i++) {
  let s = b.readInt16LE(dataStart + i * 2) * gain;
  s = Math.max(-32768, Math.min(32767, s));
  out.writeInt16LE(s, dataStart + i * 2);
}
fs.mkdirSync("data/audio", { recursive: true });
fs.writeFileSync(dest, out);
console.log("wrote", dest);
