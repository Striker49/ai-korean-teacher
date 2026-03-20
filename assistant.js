import OpenAI from "openai";
import readlineSync from "readline-sync";
import fs from "fs";
import dotenv from "dotenv";
import { MEMORY_FILE, MAX_TURNS } from "./config.js";
import { loadJsonArray, addMemory, getRelevantMemories } from "./memory.js";
import { recordAudio, transcribeAudio, textToAudio, stopAudio } from "./voice.js";

dotenv.config();

let memory = loadJsonArray(MEMORY_FILE);
let conversationHistory = [];
let teacherMode = "general";


const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "<YOUR_SITE_URL>",
    "X-Title": "<YOUR_SITE_NAME>",
  },
});

function buildSystemPrompt(latestUserMessage = "") {
  const relevantMemories = getRelevantMemories(memory, latestUserMessage);

  return `You are a patient Korean teacher for an English-speaking learner.

    Be helpful, natural, and concise.
    Use formal speech unless stated otherwise.
    Maintain context across the conversation.

    Your goals:
    - help the user practice Korean naturally
    - correct mistakes clearly and kindly
    - explain grammar in simple English
    - encourage active practice
    - adapt to the user's level

    Rules:
    - Keep responses short (2-4 sentences unless asked for more).
    - Do NOT over-explain.
    - When the user writes in Korean:
      1. Show corrected version (if needed)
      2. Give a short explanation
    - Prefer simple Korean examples with English translation.
    - Ask follow-up questions to keep the conversation going.
    - During quizzes: ask one question only.
    - Be supportive, never harsh.

${
  relevantMemories.length > 0
    ? `Relevant context:\n- ${relevantMemories.join("\n- ")}`
    : ""
}`;
}

async function askAI(latestUserMessage) {
  const systemPrompt = buildSystemPrompt(latestUserMessage);
  //console.log("conversatio history: ", conversationHistory);
  conversationHistory.push({role: "user", content: latestUserMessage})

  const trimmedHistory = conversationHistory.slice(-MAX_TURNS * 2);

  const completion = await openai.chat.completions.create({
    model: "stepfun/step-3.5-flash:free",
    messages: [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
    ],
  });

  return completion.choices?.[0]?.message?.content ?? "I couldn't generate a reply.";
}

function cleanReplyForSpeech(reply) {
  return reply.replace(/\*/g, "").trim();
}

function userCommand(trimmed) {
  if (trimmed.toLowerCase() == 'exit')
    process.exit(0);

  if (/^remember /i.test(trimmed)) {
    const data = trimmed.replace(/^remember /i, "").trim();
    addMemory(data);
    console.log("🧠 Memory saved.");
    //return;
  }
}

async function handleUserInput(userInput) {
  const trimmed = userInput.trim();
  if (!trimmed) return;

  userCommand(trimmed);

  stopAudio();

  const finalReply = await askAI(trimmed);

  conversationHistory.push({role: "assistant", content: finalReply})


  console.log("\x1b[32mAI:", finalReply, "\x1b[0m\n");
  await textToAudio(cleanReplyForSpeech(finalReply, teacherMode === "general" ? null : "ko"));
}

async function listenOnce() {
  console.log("🎤 Speak now...");
  const filePath = await recordAudio(5000);
  console.log("🧠 Transcribing...");

  let transcript;
  if (teacherMode == "general")
    transcript = await transcribeAudio(filePath);
  else
    transcript = await transcribeAudio(filePath, "ko");

  if (!transcript) {
    console.log("No speech detected.");
    return;
  }

  if (transcript.trim() == ("(speaking in foreign language)"))
    transcript = await transcribeAudio(filePath, "ko");
  console.log("You said:", transcript);
  await handleUserInput(transcript);
}

function createFolders() {
  if (!fs.existsSync("audio")) fs.mkdirSync("audio");
  if (!fs.existsSync("memory")) fs.mkdirSync("memory");
}

async function main() {
  createFolders();
  console.log("🤖 AI Assistant started.");
  console.log("Type normally, or use /v to speak, or 'exit' to quit.");

  while (true) {
    const userInput = readlineSync.question("> ");

    try {
      if (userInput.trim() === "/v") {
        await listenOnce();
      } else {
        await handleUserInput(userInput);
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
  }
}

main();