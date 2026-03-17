import OpenAI from "openai";
import readlineSync from "readline-sync";
import fs, { writeFileSync } from "fs";
import dotenv from "dotenv";
import { exec, execSync } from "child_process";
//import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';

dotenv.config();

// const elevenlabs = new ElevenLabsClient({
//     apiKey: process.env.ELEVENLABS_API_KEY, // Defaults to process.env.ELEVENLABS_API_KEY
// });

// async function textToAudio(message) {
//     const audio = await elevenlabs.textToSpeech.convert(
//         'JBFqnCBsd6RMkjVDRZzb', // voice_id
//         {
//             text: message,
//             modelId: 'eleven_multilingual_v2',
//             outputFormat: 'mp3_44100_128', // output_format
//         }
//     );
//     await play(audio);
// }

async function textToAudio(message) {
    const response = await fetch(`http://localhost:5002/api/tts?text=${message}`);
    const audioBuffer = await response.arrayBuffer();
    writeFileSync("output.wav", Buffer.from(audioBuffer));
    execSync("ffplay -nodisp -autoexit output.wav");
}



const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MEMORY_FILE = "memory.json";

// Load memory
function loadMemory() {
    if (!fs.existsSync(MEMORY_FILE)) return {};
    const raw = fs.readFileSync(MEMORY_FILE);
    const memories = JSON.parse(raw);
    return Array.isArray(memories) ? memories : [memories];
}

// Save memory
function saveMemory(memory) {
    let oldMemory = [];

    if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
        oldMemory = JSON.parse(raw);
        console.log(oldMemory);
        console.log(memory);
        console.log(JSON.stringify(oldMemory, null, 2));
    }
    oldMemory.push(memory);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(oldMemory, null, 2));
    //fs.appendFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

let memory = loadMemory();

async function askAI(message) {
  //console.log('prompt', prompt);
  //console.log('AI_API_KEY: ', process.env.OPENROUTER_API_KEY);
  let completion;
  try {
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.
        "X-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.
      }
    });
      completion = await openai.chat.completions.create({
        model: "openrouter/hunter-alpha",
        messages: [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": `You are Sébastien's personal AI assistant.
                        User memory: ${JSON.stringify(memory)}message
                        
                        User message: ${message}`
              }
            ]
          }
        ],
        
      });
    } catch(e) {
      console.log('Failed to get an answer from the LLM');
    }
    //console.log('Completion: ', completion.choices[0].message.content);
    return completion.choices[0].message.content;
}

async function main() {
  console.log("🤖 AI Assistant started. Type 'exit' to quit.");

  while (true) {
    const userInput = readlineSync.question("> ");

    if (userInput === "exit") break;

    if (/^remember /i.test(userInput)) {
        const data = userInput.replace(/^remember /i, "");
        memory.note = data;
        saveMemory(memory);
        console.log("🧠 Memory saved.");
        continue;
    }

    if (userInput === "open vscode") {
        exec("code");
        console.log("Opening VSCode...");
        continue;
    }

    const reply = await askAI(userInput);

    console.log("\x1b[32mAI:\x1b[0m", reply, "\n");

    const cleanReply = reply.replace(/\*/g, "");
    
    await textToAudio(cleanReply);
  }
}

main();