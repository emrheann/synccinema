import { GoogleGenAI } from "@google/genai";

// Determine model based on task
const TEXT_MODEL = "gemini-2.5-flash";
const VISION_MODEL = "gemini-2.5-flash";

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // API Key is injected by the environment
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async analyzeScene(imageBase64: string, prompt: string = "Bu film sahnesinde neler oluyor? Detaylı anlat."): Promise<string> {
    try {
      // Clean base64 string if necessary (remove data URL prefix)
      const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

      const response = await this.ai.models.generateContent({
        model: VISION_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
              }
            },
            {
              text: prompt
            }
          ]
        },
        config: {
          systemInstruction: "Sen bir sinema eleştirmeni ve detaylı gözlemcisin. Görseldeki sahneyi analiz et."
        }
      });

      return response.text || "Analiz yapılamadı.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Üzgünüm, şu an bu sahneyi analiz edemiyorum.";
    }
  }

  async chatAboutMovie(history: string[], message: string): Promise<string> {
    try {
        // Construct a simple history string for context
        const context = history.join('\n');
        
        const response = await this.ai.models.generateContent({
            model: TEXT_MODEL,
            contents: `Önceki Konuşma:\n${context}\n\nKullanıcı: ${message}`,
            config: {
                systemInstruction: "Sen yardımcı bir sinema asistanısın. Kullanıcılarla filmler hakkında Türkçe sohbet et. Kısa ve öz cevaplar ver."
            }
        });
        return response.text || "Cevap üretilemedi.";
    } catch (error) {
        console.error("Gemini Chat Error:", error);
        return "Bağlantı hatası.";
    }
  }
}

export const geminiService = new GeminiService();