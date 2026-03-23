import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini AI Configuration (DNA Vector 020)
 * Uses Gemini 3 Flash for high-speed OCR and data extraction.
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const getGeminiModel = (modelName = "gemini-3-flash") => {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
    }
  });
};
