import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function classifyEmergency(description: string) {
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Aegis AI, an emergency response assistant.
      Context: ${context}
      User Message: ${message}
      Provide helpful, calm guidance.`,
    });
    return response.text;
  } catch (error) {
    return "I'm having trouble connecting right now, but please stay safe and follow local emergency protocols.";
  }
}
