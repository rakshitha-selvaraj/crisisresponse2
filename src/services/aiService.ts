import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function classifyEmergency(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Classify this emergency report based on urgency (low, medium, high, critical) and type (medical, natural_calamity, fire, security, other). 
      Provide the result in JSON format with keys 'urgency', 'type', and a brief 'summary'.
      Report: "${description}"`,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Classification Error:", error);
    return { urgency: "medium", type: "other", summary: "Auto-classified due to processing error." };
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
