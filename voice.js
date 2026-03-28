import fs from "fs";
import { AUDIO_FILE, MIC_NAME, WHISPER_EXE, WHISPER_MODEL } from "./config.js";
import { spawn, execSync } from "child_process";
import edgeTTS from "node-edge-tts";
import path from "path";
import os from "os";

const { EdgeTTS } = edgeTTS;

let currentAudioPlayer = null;
const OUTPUT_FILE = "audio/output.mp3";


const EN_VOICE = "en-US-AriaNeural";
const KO_VOICE = "ko-KR-SunHiNeural";

function createTTS(voice, lang) {
  return new EdgeTTS({
    voice,
    lang,
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    timeout: 10000,
  });
}

function isKoreanChar(char) {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(char);
}

function isWhitespaceOrPunctuation(char) {
  return /[\s\p{P}]/u.test(char);
}

function splitByLanguage(text) {
  const chunks = [];
  let current = "";
  let currentType = null;

  for (const char of text) {
    const type = isKoreanChar(char) ? "ko" : "en";

    if (currentType === null) {
      currentType = type;
      current = char;
      continue;
    }

    if (isWhitespaceOrPunctuation(char)) {
      current += char;
      continue;
    }

    if (type === currentType) {
      current += char;
    } else {
      if (current.trim()) {
        chunks.push({lang: currentType, text: current.trim()});
      }
      current = char;
      currentType = type;
    }
  }
  if (current.trim()) {
    chunks.push({lang: currentType, text: current.trim()});
  }
  return (chunks);
}

async function concatMp3Files(files, outputFile) {
  const listFile = path.join(os.tmpdir(), `tts_concat_${Date.now()}.txt`);

  const content = files
    .map((file) => `file '${path.resolve(file).replace(/'/g, "'\\''")}'`)
    .join("\n");

  fs.writeFileSync(listFile, content, "utf8");

  try {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c",
        "copy",
        outputFile,
      ],
      { stdio: "ignore" }
    );

    await waitForProcessClose(ffmpeg);
  } finally {
    if (fs.existsSync(listFile)) {
      fs.unlinkSync(listFile);
    }
  }
}

async function synthesizeChunk(text, lang, outFile) {
  const voice = lang === "ko" ? KO_VOICE : EN_VOICE;
  const locale = lang === "ko" ? "ko-KR" : "en-US";

  const tts = createTTS(voice, locale);
  await tts.ttsPromise(text, outFile);
}

function playAudio(filePath) {
  currentAudioPlayer = spawn(
    "ffplay",
    ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath],
    { stdio: "ignore" }
  );

  currentAudioPlayer.on("close", () => {
    currentAudioPlayer = null;
  });

  currentAudioPlayer.on("error", (err) => {
    console.error("Audio playback error:", err.message);
    currentAudioPlayer = null;
  });
}

export function stopAudio() {
  if (currentAudioPlayer) {
    try {
      execSync(`taskkill /pid ${currentAudioPlayer.pid} /f /t`, { stdio: "ignore" });
    } catch {
      // process may already be gone
    }
    currentAudioPlayer = null;
  }
}

function sanitizeForSpeech(message) {
  return message
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "")
    .replace(/\*/g, "")
    .trim();
}

function waitForProcessClose(proc) {
  return new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

export async function textToAudio(message) {
  if (!message || !message.trim()) return;

  if (!fs.existsSync("audio")) {
    fs.mkdirSync("audio", { recursive: true });
  }

  stopAudio();

  // Remove emojis / unsupported symbols
  message = sanitizeForSpeech(message);
  const chunks = splitByLanguage(message);

  if (chunks.length === 0)
    return;

  const tempFiles = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const tempFile = `audio/chunk_${i}.mp3`;
      tempFiles.push(tempFile);
      await synthesizeChunk(chunks[i].text, chunks[i].lang, tempFile);
    }

    if (tempFiles.length === 1) {
      fs.copyFileSync(tempFiles[0], OUTPUT_FILE);
    } else {
      await concatMp3Files(tempFiles, OUTPUT_FILE);
    }

    playAudio(OUTPUT_FILE);
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  }
}

let ffmpegRecorder = null;

export function recordAudio() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(AUDIO_FILE)) fs.unlinkSync(AUDIO_FILE);

    ffmpegRecorder = spawn("ffmpeg", [
      "-y",
      "-f", "dshow",
      "-i", MIC_NAME,
      "-ac", "1",
      "-ar", "16000",
      "-acodec", "pcm_s16le",
      AUDIO_FILE,
    ], { stdio: ["pipe", "pipe", "pipe"]});

    let stderr = "";
    ffmpegRecorder.stderr.on("data", d => stderr += d.toString());
    ffmpegRecorder.on("error", reject);
    ffmpegRecorder.on("close", code => {
      ffmpegRecorder = null;
      const gracefulCodes = [0, 1, 3199971767]
      // code 1 is normal for ffmpeg when killed via stdin "q"
      if (gracefulCodes.includes(code)) resolve(AUDIO_FILE);
      else reject(new Error(`ffmpeg failed: ${stderr}`));
    });
  });
}

export function stopRecording() {
  if (ffmpegRecorder) {
    // Send "q" to ffmpeg stdin — graceful stop, flushes the file properly
    ffmpegRecorder.stdin.write("q");
    ffmpegRecorder.stdin.end();
    return new Promise(resolve => setTimeout(resolve, 300));
  }
  return Promise.resolve();
}


export function transcribeAudio(filePath, language = null) {
  if (!language)
    console.log("transcribeAudio...");
  else
    console.log("transcribeAudio...", language);
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      WHISPER_MODEL,
      "-f",
      filePath,
      "transcribe",
      "-nt",
    ];

    if (language) {
      args.push("-l", language);
    }

    const whisper = spawn(WHISPER_EXE, args);

    let stdout = "";
    let stderr = "";

    whisper.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    whisper.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    whisper.on("error", reject);

    whisper.on("close", (code) => {

      if (code === 0) {
        const result = stdout.trim() || stderr.trim();
        resolve(result);
      } else {
        reject(new Error(stderr || `Whisper failed with code ${code}`));
      }
    });
  });
}

export async function replayAudio() {
  if (!fs.existsSync(OUTPUT_FILE)) return;
  stopAudio();
  playAudio(OUTPUT_FILE);
}