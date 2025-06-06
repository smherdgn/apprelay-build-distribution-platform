
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChangelogAnalysis } from "../types";

// API key MUST be obtained exclusively from process.env.API_KEY.
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
let geminiInitialized = false;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
    geminiInitialized = true;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    ai = null; // Ensure ai is null if initialization fails
  }
} else {
  console.warn(
    "Gemini API key (process.env.API_KEY) is not configured. Gemini features will be disabled if the 'geminiEnabled' setting is true and no API key is provided."
  );
}

const GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-04-17";

export const summarizeChangelogDifferences = async (
  currentChangelog: string,
  previousChangelog?: string
): Promise<ChangelogAnalysis> => {
  if (!ai) { // This check is for if the SDK itself failed to init or API_KEY is missing
    return { error: "Gemini API client not initialized. This might be due to a missing API_KEY environment variable." };
  }

  // The decision to *call* this function should be gated by `settings.geminiEnabled` in the UI/caller.
  // This service doesn't know about settings directly.

  let prompt = `Analyze the following changelog. Provide a concise summary of key changes.`;
  if (previousChangelog) {
    prompt = `Compare the following two changelogs. Highlight key differences and new additions in the current changelog compared to the previous one. Provide a concise summary.

Previous Changelog:
\`\`\`
${previousChangelog}
\`\`\`

Current Changelog:
\`\`\`
${currentChangelog}
\`\`\`
`;
  } else {
    prompt += `\n\nChangelog:\n\`\`\`\n${currentChangelog}\n\`\`\``;
  }


  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
    });
    
    const summary = response.text;
    return { summary };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    let errorMessage = "Failed to analyze changelog using Gemini API.";
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
    }
    return { error: errorMessage };
  }
};

/**
 * Checks if the Gemini SDK was initialized successfully (i.e., API_KEY was present and valid at startup).
 * The actual enabling/disabling of the feature in the UI should be controlled by the 'geminiEnabled' setting.
 */
export const isGeminiClientInitialized = (): boolean => {
  return geminiInitialized && !!ai;
};
