/**
 * Prompt Manager — centralized prompts for ARIA AI flows.
 */

import {
  SECTION_KEYS,
  SECTION_META,
  type Requirements,
  type Ambiguity,
  type SectionKey,
} from "./types.ts";

const SECTION_LIST = SECTION_KEYS.map(
  (key) => `- ${key}: ${SECTION_META[key].label} — ${SECTION_META[key].hint}`,
).join("\n");

export const SYSTEM_ARIA = `You are ARIA (AI Requirements Intelligence Assistant), an expert business analyst.
You help sales and pre-sales teams gather software requirements through guided conversation,
then produce developer-ready documentation.

Requirement categories (always use these exact keys):
${SECTION_LIST}

Rules:
- Be concise, professional, and specific.
- Prefer measurable outcomes over vague language.
- Detect missing categories, ambiguity, and contradictions.
- Always respond with valid JSON when asked for structured output.
- Never invent requirements the client did not state; mark gaps instead.`;

export type AnalyzeBriefPromptInput = {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
};

export function buildAnalyzeBriefPrompt(input: AnalyzeBriefPromptInput): string {
  return `Analyze the following client brief and extract structured requirements.

Client: ${input.clientName}
Project: ${input.projectName}
Industry: ${input.industry || "General"}

Brief:
"""
${input.brief}
"""

Return JSON with this exact shape:
{
  "extractedRequirements": {
    "businessGoals": ["..."],
    "users": ["..."],
    "features": ["..."],
    "workflows": ["..."],
    "businessRules": ["..."],
    "integrations": ["..."],
    "reports": ["..."],
    "nonFunctional": ["..."]
  },
  "missingCategories": ["sectionKey", "..."],
  "firstQuestion": "A focused follow-up question to fill the highest-priority gap",
  "firstQuestionSection": "one of the section keys",
  "summary": "1-2 sentence summary of what you understood from the brief"
}

Guidelines:
- Only put content in a category if the brief clearly supports it; use empty arrays otherwise.
- missingCategories = section keys with little or no usable information.
- firstQuestion should target the most important missing or weak category.
- firstQuestionSection must be one of: ${SECTION_KEYS.join(", ")}.`;
}

export type ContinueConversationPromptInput = {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
  requirements: Requirements;
  missingCategories: SectionKey[];
  ambiguities: Ambiguity[];
  userMessage: string;
  recentMessages: Array<{ role: string; content: string }>;
};

export function buildContinueConversationPrompt(
  input: ContinueConversationPromptInput,
): string {
  const history = input.recentMessages
    .slice(-12)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `Continue a requirements intake conversation.

Client: ${input.clientName}
Project: ${input.projectName}
Industry: ${input.industry || "General"}
Original brief: ${input.brief || "(none)"}

Current structured requirements:
${JSON.stringify(input.requirements, null, 2)}

Currently missing / weak categories: ${JSON.stringify(input.missingCategories)}
Open ambiguities: ${JSON.stringify(input.ambiguities)}

Recent conversation:
${history || "(no prior messages)"}

Latest user reply:
"""
${input.userMessage}
"""

Update the requirements using the user's reply, detect ambiguity/contradictions,
and ask the single next-best follow-up question (or mark intake complete).

Return JSON with this exact shape:
{
  "updatedRequirements": {
    "businessGoals": ["..."],
    "users": ["..."],
    "features": ["..."],
    "workflows": ["..."],
    "businessRules": ["..."],
    "integrations": ["..."],
    "reports": ["..."],
    "nonFunctional": ["..."]
  },
  "missingCategories": ["sectionKey", "..."],
  "ambiguities": [
    { "id": "string", "section": "sectionKey", "note": "string", "resolved": false }
  ],
  "contradictions": [
    { "id": "string", "sections": ["sectionKey"], "note": "string" }
  ],
  "nextQuestion": "string or null if intake is complete",
  "nextQuestionSection": "sectionKey or null",
  "progress": 0,
  "currentSection": "sectionKey or null",
  "intakeComplete": false,
  "assistantMessage": "What ARIA should say next (include the question if any)"
}

Guidelines:
- Merge new info into the right categories; preserve prior useful items.
- progress is 0–100 based on how many categories have solid content.
- Prefer clarifying vague answers (e.g. "fast", "user friendly", "asap") before moving on.
- When all 8 categories have usable content and major ambiguities are addressed, set intakeComplete=true and nextQuestion=null.
- assistantMessage should be conversational markdown suitable for a chat UI.`;
}

export type GenerateDocumentsPromptInput = {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
  requirements: Requirements;
  ambiguities: Ambiguity[];
};

export function buildGenerateDocumentsPrompt(
  input: GenerateDocumentsPromptInput,
): string {
  return `Generate a full set of requirements documents from structured intake data.

Client: ${input.clientName}
Project: ${input.projectName}
Industry: ${input.industry || "General"}
Brief: ${input.brief || "(none)"}

Structured requirements:
${JSON.stringify(input.requirements, null, 2)}

Open ambiguities:
${JSON.stringify(input.ambiguities.filter((a) => !a.resolved))}

Return JSON with this exact shape (all values are Markdown strings):
{
  "brd": "# Business Requirements Document ...",
  "srs": "# Software Requirements Specification ...",
  "userStories": "# User Stories ...",
  "acceptanceCriteria": "# Acceptance Criteria ...",
  "clientSummary": "# Client Summary ..."
}

Document guidance:
- BRD: executive summary, goals, stakeholders, scope, business rules, reporting, open questions.
- SRS: actors, functional requirements (FR-x.y), workflows, integrations, NFRs, traceability.
- User Stories: epic-grouped "As a… I want… so that…" with priority hints.
- Acceptance Criteria: Given/When/Then per major story plus rule-based criteria.
- Client Summary: plain-English recap for business stakeholders (no jargon).
- Use only information present in the requirements; flag gaps as open questions.
- Include project name, client, industry, and today's date in headers where appropriate.
- Prepared by: ARIA — AI Requirements Intelligence Assistant.`;
}
