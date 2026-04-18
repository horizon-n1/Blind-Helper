# Blind-Helper: AI-Assisted Navigation

This project presents a highly polished, empathetic accessibility tool that combines a conversational AI interface with robust embedded hardware. By pairing an active Web App interface with an independent hardware safety net, it guarantees both fluid interaction and mission-critical safety for visually impaired users.

## System Architecture

The overarching design operates on a **Dual-Layer Architecture** to decouple high-level reasoning and interaction from real-time dynamic obstacle detection.

### Layer 1: The Cloud Layer (The Guide)
The phone web app provides "Macro" navigation, acting as the conversational partner. Built primarily using vanilla HTML and JavaScript, this layer runs in the browser leveraging a chain of powerful APIs:

*   **The Ears (Web Speech API):** Utilizes the browser's native `webkitSpeechRecognition`. It is free, instantaneous, and requires no API keys, seamlessly listening for user commands (e.g., "Take me to the master bedroom").
*   **The Brain (LLM API - OpenAI or Gemini):** Captures transcribed text and feeds it to a Large Language Model alongside a system prompt mapping the environment (e.g., "You are an accessibility assistant. The bedroom is 10 steps forward and left."). The LLM generates the conversational response and the targeted route.
*   **The Voice (ElevenLabs API):** Transmits the LLM's text output to ElevenLabs to stream ultra-realistic, empathetic conversational audio directly back to the user's headphones in real-time.
*   **The Eyes (TensorFlow.js / GPT-4o Vision):** Captures video frames from the user's phone camera. A lightweight local model (like `coco-ssd`) detects major obstacles, or a vision-capable LLM analyzes sampled scene frames to provide high-level context.

### Layer 2: The Edge Layer (The Reflexes)
*Why is this necessary? To avoid the "Cloud Latency Death Trap."*

If the system relies *solely* on cloud AI to alert the user about immediate obstacles, the average latency of 1.5 to 3 seconds for image processing, AI routing, and API audio generation is critically slow. At an average human walking speed of 4.5 feet per second, an obstacle 5 feet away would result in a collision before the AI can issue a warning.

To bypass this flaw, a dedicated STM32 or Arduino microcontroller acts as the "Micro" safety net on the user's cane:
*   Runs entirely **offline** and on the edge.
*   Ultrasonic sensors capture environmental data 50 times per second.
*   If an obstacle appears abruptly (e.g., within 3 feet) in front of the cane, the microcontroller immediately guarantees a hardware beep or intense vibration in milliseconds—halting the user instantly.

## The Systems Engineering Pitch

Combining an advanced ElevenLabs AI web app on a phone with an immediate embedded hardware safety system on a cane circumvents the latency and edge-case pitfalls typical of software-only approaches. This dual-layer architecture strikes the perfect balance—deploying high-level, cloud-based AI computing for empathetic guidance coupled strictly with low-level, mission-critical hardware timing for uncompromising safety.

---

## Hardware Requirements

*   **Microcontroller:** STM32 or Arduino board (e.g., Arduino Uno/Nano).
*   **Sensors:** Ultrasonic sensor (e.g., HC-SR04) for edge-level distance checking.
*   **Actuators:** Haptic vibration motor or piezo buzzer for instantaneous sensory feedback.

## Software Prerequisites

*   [Node.js](https://nodejs.org/en/) (v16 or higher recommended).
*   An active OpenAI API Key.
*   An active ElevenLabs API Key and Voice ID.

## Project Structure

```bash
📦 Blind-Helper
 ┣ 📂 client       # Frontend Web App utilizing Web Speech API and WebCam
 ┣ 📂 server       # Node.js Backend handling API routing (OpenAI & ElevenLabs)
 ┗ 📂 firmware     # Embedded C/C++ Code for the local hardware safety net
```

## Installation & Setup

**1. Configure Environment Variables**
Navigate to the `server` directory and ensure your `.env` file contains your credentials (see the existing `.env` file):
```env
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
PORT=3001
```

**2. Run the Node Backend**
```bash
cd server
npm install
npm start # or node server.js
```

**3. Run the Client Web App**
Launch the web interface by serving the `client` directory. If you are using VS Code, the "Live Server" extension is an easy way to spin this up.

**4. Flash the Hardware Failsafe**
Open the code within the `firmware` directory using your hardware's IDE (such as Arduino IDE or STM32CubeIDE) and flash it directly to your microcontroller.
