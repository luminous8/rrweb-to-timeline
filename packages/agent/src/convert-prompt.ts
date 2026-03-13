import type { LanguageModelV3Prompt } from "@ai-sdk/provider";

export interface ConvertedPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export const convertPrompt = (prompt: LanguageModelV3Prompt): ConvertedPrompt => {
  const systemParts: string[] = [];
  const userParts: string[] = [];

  for (const message of prompt) {
    if (message.role === "system") {
      systemParts.push(message.content);
    }

    if (message.role === "user") {
      for (const part of message.content) {
        if (part.type === "text") userParts.push(part.text);
      }
    }
  }

  return {
    systemPrompt: systemParts.join("\n\n"),
    userPrompt: userParts.join("\n\n"),
  };
};
