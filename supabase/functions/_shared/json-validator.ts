/**
 * JSON Validator — lightweight schema checks for Gemini structured outputs.
 */

import {
  SECTION_KEYS,
  emptyRequirements,
  type AnalyzeBriefResult,
  type ContinueConversationResult,
  type GenerateDocumentsResult,
  type Requirements,
  type SectionKey,
  type Ambiguity,
  type Contradiction,
} from "./types.ts";

export class ValidationError extends Error {
  constructor(
    message: string,
    public path?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asSectionKey(value: unknown): SectionKey | null {
  if (typeof value !== "string") return null;
  return (SECTION_KEYS as readonly string[]).includes(value)
    ? (value as SectionKey)
    : null;
}

function asSectionKeyArray(value: unknown): SectionKey[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asSectionKey)
    .filter((v): v is SectionKey => v !== null);
}

function normalizeRequirements(value: unknown): Requirements {
  const base = emptyRequirements();
  if (!isObject(value)) return base;
  for (const key of SECTION_KEYS) {
    base[key] = asStringArray(value[key]);
  }
  return base;
}

function normalizePartialRequirements(
  value: unknown,
): Partial<Requirements> {
  if (!isObject(value)) return {};
  const out: Partial<Requirements> = {};
  for (const key of SECTION_KEYS) {
    if (key in value) {
      out[key] = asStringArray(value[key]);
    }
  }
  return out;
}

function normalizeAmbiguities(value: unknown): Ambiguity[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item, i) => {
      const section = asSectionKey(item.section) ?? "features";
      return {
        id: asString(item.id, `amb-${i + 1}`),
        section,
        note: asString(item.note, "Ambiguity flagged"),
        resolved: Boolean(item.resolved),
      };
    })
    .filter((a) => a.note.length > 0);
}

function normalizeContradictions(value: unknown): Contradiction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item, i) => ({
      id: asString(item.id, `con-${i + 1}`),
      sections: asSectionKeyArray(item.sections),
      note: asString(item.note, "Contradiction flagged"),
    }))
    .filter((c) => c.note.length > 0);
}

/**
 * Strip markdown code fences if the model wraps JSON anyway.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new ValidationError("Response is not valid JSON");
  }
}

export function validateAnalyzeBrief(raw: unknown): AnalyzeBriefResult {
  const data = isObject(raw) ? raw : (() => {
    throw new ValidationError("analyzeBrief result must be an object");
  })();

  const firstQuestion = asString(data.firstQuestion).trim();
  if (!firstQuestion) {
    throw new ValidationError("firstQuestion is required", "firstQuestion");
  }

  const firstQuestionSection =
    asSectionKey(data.firstQuestionSection) ??
    asSectionKeyArray(data.missingCategories)[0] ??
    "businessGoals";

  return {
    extractedRequirements: normalizePartialRequirements(
      data.extractedRequirements,
    ),
    missingCategories: asSectionKeyArray(data.missingCategories),
    firstQuestion,
    firstQuestionSection,
    summary: asString(data.summary),
  };
}

export function validateContinueConversation(
  raw: unknown,
): ContinueConversationResult {
  const data = isObject(raw) ? raw : (() => {
    throw new ValidationError(
      "continueConversation result must be an object",
    );
  })();

  const updatedRequirements = normalizeRequirements(data.updatedRequirements);
  let progress =
    typeof data.progress === "number" && Number.isFinite(data.progress)
      ? Math.max(0, Math.min(100, Math.round(data.progress)))
      : 0;

  const intakeComplete = Boolean(data.intakeComplete);
  const nextQuestion = data.nextQuestion == null
    ? null
    : asString(data.nextQuestion).trim() || null;
  const nextQuestionSection = asSectionKey(data.nextQuestionSection);
  const currentSection =
    asSectionKey(data.currentSection) ?? nextQuestionSection;

  const assistantMessage = asString(data.assistantMessage).trim() ||
    (nextQuestion ??
      "That covers the key requirement areas. You can generate documents when ready.");

  if (intakeComplete) {
    progress = Math.max(progress, 90);
  }

  return {
    updatedRequirements,
    missingCategories: asSectionKeyArray(data.missingCategories),
    ambiguities: normalizeAmbiguities(data.ambiguities),
    contradictions: normalizeContradictions(data.contradictions),
    nextQuestion: intakeComplete ? null : nextQuestion,
    nextQuestionSection: intakeComplete ? null : nextQuestionSection,
    progress,
    currentSection: intakeComplete ? null : currentSection,
    intakeComplete,
    assistantMessage,
  };
}

export function validateGenerateDocuments(
  raw: unknown,
): GenerateDocumentsResult {
  const data = isObject(raw) ? raw : (() => {
    throw new ValidationError("generateDocuments result must be an object");
  })();

  const brd = asString(data.brd).trim();
  const srs = asString(data.srs).trim();
  const userStories = asString(data.userStories).trim();
  const acceptanceCriteria = asString(data.acceptanceCriteria).trim();
  const clientSummary = asString(data.clientSummary).trim();

  if (!brd || !srs || !userStories || !acceptanceCriteria || !clientSummary) {
    throw new ValidationError(
      "All five document fields (brd, srs, userStories, acceptanceCriteria, clientSummary) are required",
    );
  }

  return { brd, srs, userStories, acceptanceCriteria, clientSummary };
}

/** Parse + validate helpers used by edge functions */
export function parseAnalyzeBrief(rawText: string): AnalyzeBriefResult {
  return validateAnalyzeBrief(extractJson(rawText));
}

export function parseContinueConversation(
  rawText: string,
): ContinueConversationResult {
  return validateContinueConversation(extractJson(rawText));
}

export function parseGenerateDocuments(
  rawText: string,
): GenerateDocumentsResult {
  return validateGenerateDocuments(extractJson(rawText));
}
