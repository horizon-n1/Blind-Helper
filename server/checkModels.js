require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listAllModels() {
  console.log("Fetching officially available models for your exact API key...");
  
  // Note: the SDK doesn't natively expose a listModels() method on genAI in all versions.
  // Instead, we will fetch it natively via standard fetch to be completely safe.
  try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      const data = await response.json();
      
      if (data.error) {
          console.error("API Key completely rejected:", data.error.message);
          return;
      }
      
      const textModels = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace('models/', ''));
        
      console.log("=== YOUR ALLOWED GEMINI MODELS ===");
      console.log(textModels.length > 0 ? textModels.join("\n") : "ZERO MODELS AVAILABLE.");
      
  } catch (err) {
      console.error(err);
  }
}

listAllModels();
