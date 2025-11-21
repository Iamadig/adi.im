import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateThought = async (topic?: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Error: API Key not configured.";

  const prompt = topic 
    ? `Write a short, insightful philosophical thought or micro-blog post about "${topic}". Keep it under 100 words. Format it like a personal journal entry.`
    : "Write a short, insightful random thought about technology, design, or life. Keep it under 100 words. Format it like a personal journal entry.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate a thought at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while generating content.";
  }
};

export const generateQuote = async (mood?: string): Promise<{ text: string; author: string }> => {
  const ai = getAiClient();
  if (!ai) return { text: "API Key missing", author: "System" };

  let prompt = "";
  if (mood && mood.trim()) {
      prompt = `Generate a profound, inspiring, or comforting quote suitable for someone who is feeling "${mood}". 
      Return ONLY the quote and the author in the following format: "Quote Text" - Author Name. 
      Do not include any other text or conversational filler.`;
  } else {
      prompt = `Generate a profound, inspiring, unique, and less common quote about life, creativity, or human nature.
      Return ONLY the quote and the author in the following format: "Quote Text" - Author Name.
      Do not include any other text or conversational filler.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const result = response.text?.trim() || "";
    // Try to split by the dash to separate author
    // We look for the last hyphen to separate author, handling hyphens in text
    const lastDashIndex = result.lastIndexOf(" - ");
    
    if (lastDashIndex !== -1) {
      let text = result.substring(0, lastDashIndex).trim();
      const author = result.substring(lastDashIndex + 3).trim();
      
      if (text.startsWith('"') && text.endsWith('"')) {
        text = text.slice(1, -1);
      }
      return { text, author };
    } else {
      // Fallback if format isn't perfect
      return { text: result.replace(/"/g, ''), author: "Unknown" };
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Every moment is a fresh beginning.", author: "T.S. Eliot" }; // Fallback
  }
};

export const polishContent = async (text: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return text;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Rewrite the following text to be more professional, engaging, and concise, while maintaining a personal tone suitable for a personal website bio: "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    return text;
  }
};