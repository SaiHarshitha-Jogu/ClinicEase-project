import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export async function fetchGeminiResponse(promptText) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt="read the following description of a medical problem and translate to professional or medical jargon if necessary without exaggerating the problem in any way, for example convert sugar to diabetes and so on, only translate what the patient has said and express it as your response in one pair of square brackets followed by what the patient actually said"+promptText;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error:", error);
    return "Oops! Something went wrong.";
  }
}
