import dotenv from "dotenv";
dotenv.config();

export const MEMORY_FILE = "memory/memory.json"
export const MAX_TURNS = 10
export const WHISPER_EXE = "C:\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe";
export const WHISPER_MODEL = "C:\\whisper.cpp\\models\\ggml-small.bin";
export const AUDIO_FILE = "audio/input.wav";
export const MIC_NAME = 'audio=Microphone (HyperX Cloud III Wireless)';
export const TTS_URL = "http://localhost:5002/api/tts";