import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is missing from environment. AI features will fallback to defaults.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export async function classifyEmergency(description: string) {
  if (!apiKey) {
    return { urgency: "medium", type: "volunteer", summary: "Offline classification (No API Key).", vehicleId: "VOL-000" };
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an AI Dispatcher. Classify this emergency report.
      
      Priority Rules:
      - CRITICAL: "fire", "explosion", "chest pain", "stopped breathing", "gunshot", "trapped".
      - HIGH: "accident", "heavy bleeding", "visible bone", "unconscious".
      - MEDIUM: "minor injury", "fever", "property damage".
      - LOW: "local assistance", "stuck", "information inquiry".

      Emergency Types: 
      - fire: Smoke, fire, explosion, chemical.
      - medical: Injuries, heart issues, sickness, psychological.
      - volunteer: General help, food/water, movement assistance.

      Assign a random Mock Vehicle ID based on type:
      - fire: FT-xxx (e.g., FT-001)
      - medical: AMB-xxx (e.g., AMB-501)
      - volunteer: VOL-xxx (e.g., VOL-101)

      Respond ONLY in JSON with: "urgency" (low, medium, high, critical), "type" (fire, medical, volunteer), "summary", and "vehicleId".
      Report: "${description}"`,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Classification Error:", error);
    return { urgency: "medium", type: "volunteer", summary: "Auto-classified due to processing error.", vehicleId: "VOL-000" };
  }
}

export async function getChatResponse(message: string, context: string) {
  if (!apiKey) {
    return "The AI system is not configured with an API key. Please check your project settings.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are Aegis AI (powered by Gemini), an emergency response assistant.
      Context: ${context}
      User Message: ${message}
      Provide helpful, calm guidance. Keep it concise.`,
    });
    return response.text;
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "I'm having trouble connecting right now, but please stay safe and follow local emergency protocols.";
  }
}
