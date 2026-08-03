/**
 * AI service wrappers — analyzeBrief, continueConversation, generateDocuments.
 * Used by dedicated edge functions and by the /api router.
 */

import { GeminiClient } from "./gemini.ts";
import {
  SYSTEM_ARIA,
  buildAnalyzeBriefPrompt,
  buildContinueConversationPrompt,
  buildGenerateDocumentsPrompt,
} from "./prompt-manager.ts";
import {
  parseAnalyzeBrief,
  parseContinueConversation,
  parseGenerateDocuments,
} from "./json-validator.ts";
import {
  computeProgress,
  emptyRequirements,
  type AnalyzeBriefResult,
  type ContinueConversationResult,
  type GenerateDocumentsResult,
  type Ambiguity,
  type Requirements,
  type SectionKey,
} from "./types.ts";

function mergeRequirements(
  base: Requirements,
  partial: Partial<Requirements>,
): Requirements {
  const next = { ...emptyRequirements(), ...base };
  for (const key of Object.keys(partial) as SectionKey[]) {
    const incoming = partial[key];
    if (!incoming?.length) continue;
    const existing = new Set(next[key]);
    for (const item of incoming) {
      if (!existing.has(item)) next[key] = [...next[key], item];
    }
  }
  return next;
}

export async function runAnalyzeBrief(input: {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
}): Promise<AnalyzeBriefResult> {
  const gemini = GeminiClient.fromEnv();
  const prompt = buildAnalyzeBriefPrompt(input);
  const raw = await gemini.generate(prompt, {
    systemPrompt: SYSTEM_ARIA,
    jsonMode: true,
    temperature: 0.3,
    maxOutputTokens: 4096,
  });
  const result = parseAnalyzeBrief(raw);

  // Ensure missingCategories reflects empty extracted buckets
  const merged = mergeRequirements(emptyRequirements(), result.extractedRequirements);
  const missing = result.missingCategories.length
    ? result.missingCategories
    : (Object.keys(merged) as SectionKey[]).filter(
      (k) => merged[k].length === 0,
    );

  return { ...result, missingCategories: missing };
}

export async function runContinueConversation(input: {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
  requirements: Requirements;
  missingCategories: SectionKey[];
  ambiguities: Ambiguity[];
  userMessage: string;
  recentMessages: Array<{ role: string; content: string }>;
}): Promise<ContinueConversationResult> {
  const gemini = GeminiClient.fromEnv();
  const prompt = buildContinueConversationPrompt(input);
  const raw = await gemini.generate(prompt, {
    systemPrompt: SYSTEM_ARIA,
    jsonMode: true,
    temperature: 0.4,
    maxOutputTokens: 6144,
  });
  const result = parseContinueConversation(raw);

  // Recompute progress from requirements if model under/over-reports
  const computed = computeProgress(result.updatedRequirements);
  result.progress = Math.max(result.progress, computed);

  if (result.intakeComplete && !result.assistantMessage.includes("document")) {
    result.assistantMessage =
      `${result.assistantMessage}\n\nI have enough to draft the **BRD, SRS, user stories, acceptance criteria and client summary**. Generate documents when you're ready.`;
  }

  return result;
}

export async function runGenerateDocuments(input: {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
  requirements: Requirements;
  ambiguities: Ambiguity[];
}): Promise<GenerateDocumentsResult> {
  const gemini = GeminiClient.fromEnv();
  const prompt = buildGenerateDocumentsPrompt(input);
  const raw = await gemini.generate(prompt, {
    systemPrompt: SYSTEM_ARIA,
    jsonMode: true,
    temperature: 0.35,
    maxOutputTokens: 16384,
  });
  return parseGenerateDocuments(raw);
}
