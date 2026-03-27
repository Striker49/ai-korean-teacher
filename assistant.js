import OpenAI from "openai";
import readline from "readline";
import fs from "fs";
import dotenv from "dotenv";
import { MEMORY_FILE, MAX_TURNS } from "./config.js";
import { loadJsonArray, addMemory, getRelevantMemories } from "./memory.js";
import { recordAudio, transcribeAudio, textToAudio, stopAudio, replayAudio, stopRecording } from "./voice.js";
import { generalPrompt, practicePrompt, translationPrompt } from "./prompts.js";

dotenv.config();
process.stdin.setEncoding("utf8");

let memory = loadJsonArray(MEMORY_FILE);
let conversationHistory = [];
let teacherMode = "general";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "<YOUR_SITE_URL>",
    "X-Title": "<YOUR_SITE_NAME>",
  },
});

function buildSystemPrompt(latestUserMessage = "", mode) {
  const relevantMemories = getRelevantMemories(memory, latestUserMessage);

  if (mode == "practice")
    return (practicePrompt(relevantMemories));
  else
    return (generalPrompt(relevantMemories));
}

async function askAI(latestUserMessage) {

  const systemPrompt = buildSystemPrompt(latestUserMessage, teacherMode);
  //console.log("conversatio history: ", conversationHistory);
  console.log("systemp prompt: ", teacherMode);
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

async function translate() {
  const systemPrompt = translationPrompt;
  const completion = await openai.chat.completions.create({
    model: "stepfun/step-3.5-flash:free",
    messages: [
      { role: "system", content: systemPrompt },
      conversationHistory[conversationHistory.length - 1]
    ],
  });
  console.log("Content translated: ", conversationHistory[conversationHistory.length - 1].content);
  //console.log(completion.choices[0].message);
  return(completion.choices[0].message.content);
}

async function userCommand(trimmed) {
  if (trimmed.toLowerCase() == 'exit')
    process.exit(0);

  if (/^remember /i.test(trimmed)) {
    const data = trimmed.replace(/^remember /i, "").trim();
    addMemory(data);
    console.log("🧠 Memory saved.");
    //return;
  }
  if (trimmed.toLowerCase() == '/pr') {
    teacherMode = "practice";
    return ("practice");
  }
  if (trimmed.toLowerCase() == '/general') {
    teacherMode = "general";
    return ("general")
  }
  if (trimmed.toLowerCase() == '/tr') {
    const translation = await translate();
    return (translation);
  }
  if (trimmed.toLowerCase() == '/repeat') {
    await replayAudio();
    return ("repeat");
  }
}

async function handleUserInput(userInput) {
  const trimmed = userInput.trim();
  if (!trimmed) return;

  let res;

  if (res = await userCommand(trimmed)) {
    if (res == "practice" || res == "general")
      console.log(`\u001b[34mChanged to ${res} mode.\u001b[0m`);
    else if (res == "repeat")
      console.log(`\u001b[34mRepeating...\u001b[0m`);
    else
      console.log(`\u001b[34mTranslation: ${res}\u001b[0m`);
    return;
  }

  stopAudio();

  const finalReply = await askAI(trimmed);

  conversationHistory.push({role: "assistant", content: finalReply});


  console.log("\x1b[32mAI:", finalReply, "\x1b[0m\n");
  await textToAudio(cleanReplyForSpeech(finalReply));
}

async function listenOnce() {
  console.log("🎤 Speak now...");
  //const filePath = await recordAudio(5000);
  const recordingPromise = recordAudio();
  await ask("");
  stopRecording();
  const filePath = await recordingPromise;
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

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  createFolders();
  console.log("🤖 AI Assistant started.");
  console.log("Type normally, or use /v to speak, or 'exit' to quit.");

  while (true) {
    const userInput = await ask("> ");

    //console.log("You typed:", userInput);

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