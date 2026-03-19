import fs from "fs";
import { AUDIO_FILE, MIC_NAME, WHISPER_EXE, WHISPER_MODEL } from "./config.js";
import { spawn, execSync } from "child_process";
import edgeTTS from "node-edge-tts";

const { EdgeTTS } = edgeTTS;

let currentAudioPlayer = null;
let teacherMode = "general";
const OUTPUT_FILE = "audio/output.mp3";

function containsKorean(text) {
  return /[가-힣]/.test(text);
}

function createTTS(text) {
  const isKorean = containsKorean(text);

  return new EdgeTTS({
    voice: isKorean ? "ko-KR-SunHiNeural" : "en-US-AriaNeural",
    lang: isKorean ? "ko-KR" : "en-US",
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    timeout: 10000,
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

export async function textToAudio(message) {
  if (!message || !message.trim()) return;

  if (!fs.existsSync("audio")) {
    fs.mkdirSync("audio", { recursive: true });
  }

  stopAudio();

  // Remove emojis / unsupported symbols
  message = message.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "");

  const tts = createTTS(message);
  await tts.ttsPromise(message, OUTPUT_FILE);

  currentAudioPlayer = spawn(
    "ffplay",
    ["-nodisp", "-autoexit", "-loglevel", "quiet", OUTPUT_FILE],
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

export function recordAudio(durationMs = 5000) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(AUDIO_FILE)) {
      fs.unlinkSync(AUDIO_FILE);
    }

    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-f", "dshow",
      "-i", MIC_NAME,
      "-ac", "1",
      "-ar", "16000",
      "-t", String(durationMs / 1000),
      "-acodec", "pcm_s16le",
      AUDIO_FILE,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", reject);

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(AUDIO_FILE);
      else reject(new Error(`ffmpeg failed with code ${code}\n${stderr}`));
    });
  });
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
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Whisper failed with code ${code}`));
      }
    });
  });
}
