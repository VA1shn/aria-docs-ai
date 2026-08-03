/**
 * Shared domain types for ARIA edge functions.
 * Aligned with the frontend model in src/lib/aria-store.ts.
 */

export const SECTION_KEYS = [
  "businessGoals",
  "users",
  "features",
  "workflows",
  "businessRules",
  "integrations",
  "reports",
  "nonFunctional",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<
  SectionKey,
  { label: string; hint: string }
> = {
  businessGoals: { label: "Business Goals", hint: "Why this project exists" },
  users: { label: "Users & Roles", hint: "Who will use the system" },
  features: { label: "Features", hint: "Core capabilities" },
  workflows: { label: "Workflows", hint: "Step-by-step processes" },
  businessRules: { label: "Business Rules", hint: "Constraints and logic" },
  integrations: { label: "Integrations", hint: "External systems" },
  reports: { label: "Reports & Analytics", hint: "Insights required" },
  nonFunctional: { label: "Non-functional", hint: "Scale, security, SLAs" },
};

export type ProjectStatus =
  | "draft"
  | "in_progress"
  | "documents_ready"
  | "approved";

export type SessionStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "documents_ready";

export type MessageRole = "user" | "assistant" | "system";

export type DocType =
  | "brd"
  | "srs"
  | "user_stories"
  | "acceptance_criteria"
  | "client_summary";

/** Frontend DocKey → DB doc_type */
export const DOC_TYPE_MAP = {
  brd: "brd",
  srs: "srs",
  userStories: "user_stories",
  acceptance: "acceptance_criteria",
  clientSummary: "client_summary",
} as const;

export type Requirements = Record<SectionKey, string[]>;

export type Ambiguity = {
  id: string;
  section: SectionKey;
  note: string;
  resolved: boolean;
};

export type Contradiction = {
  id: string;
  sections: SectionKey[];
  note: string;
};

export type AskedCount = Record<SectionKey, number>;

export type Project = {
  id: string;
  user_id: string;
  client_name: string;
  project_name: string;
  industry: string;
  brief: string;
  attachments: string[];
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  project_id: string;
  user_id: string;
  status: SessionStatus;
  requirements: Requirements;
  missing_categories: SectionKey[];
  ambiguities: Ambiguity[];
  progress: number;
  current_section: SectionKey | null;
  asked_count: AskedCount;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Message = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  section: SectionKey | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type GeneratedDocument = {
  id: string;
  session_id: string;
  project_id: string;
  user_id: string;
  doc_type: DocType;
  title: string;
  content: string;
  structured_content: Record<string, unknown> | null;
  version: number;
  created_at: string;
  updated_at: string;
};

/** analyzeBrief AI response */
export type AnalyzeBriefResult = {
  extractedRequirements: Partial<Requirements>;
  missingCategories: SectionKey[];
  firstQuestion: string;
  firstQuestionSection: SectionKey;
  summary: string;
};

/** continueConversation AI response */
export type ContinueConversationResult = {
  updatedRequirements: Requirements;
  missingCategories: SectionKey[];
  ambiguities: Ambiguity[];
  contradictions: Contradiction[];
  nextQuestion: string | null;
  nextQuestionSection: SectionKey | null;
  progress: number;
  currentSection: SectionKey | null;
  intakeComplete: boolean;
  assistantMessage: string;
};

/** generateDocuments AI response */
export type GenerateDocumentsResult = {
  brd: string;
  srs: string;
  userStories: string;
  acceptanceCriteria: string;
  clientSummary: string;
};

export function emptyRequirements(): Requirements {
  return {
    businessGoals: [],
    users: [],
    features: [],
    workflows: [],
    businessRules: [],
    integrations: [],
    reports: [],
    nonFunctional: [],
  };
}

export function emptyAskedCount(): AskedCount {
  return {
    businessGoals: 0,
    users: 0,
    features: 0,
    workflows: 0,
    businessRules: 0,
    integrations: 0,
    reports: 0,
    nonFunctional: 0,
  };
}

export function computeProgress(requirements: Requirements): number {
  const filled = SECTION_KEYS.filter(
    (key) => (requirements[key]?.length ?? 0) > 0,
  ).length;
  return Math.round((filled / SECTION_KEYS.length) * 100);
}
