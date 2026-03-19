# 🇰🇷 AI Korean Teacher Assistant

A voice-enabled AI assistant that helps you practice Korean through conversation, corrections, and explanations.

---

## ✨ Features

* 🎤 Speech-to-text with **Whisper.cpp**
* 🔊 Text-to-speech with **Edge TTS**
* 🧠 AI Korean tutor:

  * Corrects mistakes
  * Explains grammar simply
  * Adapts to your level
  * Roleplays real-life situations
* 🔁 Smart transcription fallback (auto → Korean retry)

---

## 🧰 Requirements

* Node.js (v18+)
* ffmpeg
* whisper.cpp
* A multilingual Whisper model (**NOT `.en`**)

---

## 📦 Installation

```bash
git clone <your-repo-url>
cd ai_korean_teacher
npm install
```

Install TTS:

```bash
npm install node-edge-tts
```

---

## 🧠 Whisper Setup

Go to your whisper.cpp folder:

```bash
cd C:\whisper.cpp
.\models\download-ggml-model.cmd small
```

This creates:

```
C:\whisper.cpp\ggml-small.bin
```

---

## ⚙️ Configuration

Edit `config.js`:

```js
export const WHISPER_EXE = "C:\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe";
export const WHISPER_MODEL = "C:\\whisper.cpp\\ggml-small.bin";
export const MIC_NAME = "audio=Your Microphone Name";
```

⚠️ Do not use `.en` models (English-only)

---

## ▶️ Run

```bash
node assistant.js
```

---

## 🎤 Usage

1. Trigger voice mode (`/voice`)
2. Speak
3. AI transcribes and responds
4. Korean is spoken back using TTS

---

## 🧪 Example

**Input:**

```
안녕 나는 학교 갔다
```

**Output:**

```
👉 Corrected: 안녕, 나는 학교에 갔어.
You missed the particle "에" and used incorrect tense.
What did you do at school?
```

---

## 💡 Notes

* Korean transcription works best with full sentences
* Edge TTS requires internet connection
* Auto-detect may retry in Korean if needed

---

## 🚀 Future Ideas

* Real-time conversation mode
* Pronunciation feedback
* Difficulty levels
* Memory-based learning

---

Enjoy learning Korean! 🇰🇷
