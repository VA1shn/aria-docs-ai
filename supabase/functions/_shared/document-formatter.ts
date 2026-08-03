/**
 * Document Formatter — titles, markdown polish, DB row shaping.
 */

import type {
  DocType,
  GenerateDocumentsResult,
  GeneratedDocument,
} from "./types.ts";

export const DOC_META: Record<
  DocType,
  { title: string; short: string; description: string }
> = {
  brd: {
    title: "Business Requirements Document",
    short: "BRD",
    description: "Objectives, scope, stakeholders and success metrics.",
  },
  srs: {
    title: "Software Requirements Specification",
    short: "SRS",
    description: "Functional and non-functional specification for engineering.",
  },
  user_stories: {
    title: "User Stories",
    short: "Stories",
    description: "Backlog-ready stories grouped by epic.",
  },
  acceptance_criteria: {
    title: "Acceptance Criteria",
    short: "Criteria",
    description: "Given / When / Then criteria per story.",
  },
  client_summary: {
    title: "Client Summary",
    short: "Summary",
    description: "Plain-English recap for business stakeholders.",
  },
};

/** Map AI result keys → DB doc_type */
export const RESULT_TO_DOC_TYPE: Record<
  keyof GenerateDocumentsResult,
  DocType
> = {
  brd: "brd",
  srs: "srs",
  userStories: "user_stories",
  acceptanceCriteria: "acceptance_criteria",
  clientSummary: "client_summary",
};

/**
 * Light markdown cleanup: normalize newlines, ensure leading heading.
 */
export function formatMarkdown(
  content: string,
  fallbackTitle: string,
): string {
  let text = content.replace(/\r\n/g, "\n").trim();
  if (!text.startsWith("#")) {
    text = `# ${fallbackTitle}\n\n${text}`;
  }
  // Collapse 3+ blank lines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

export type DocumentInsert = {
  session_id: string;
  project_id: string;
  user_id: string;
  doc_type: DocType;
  title: string;
  content: string;
  structured_content: null;
  version: number;
};

/**
 * Turn a GenerateDocumentsResult into rows ready for generated_documents insert.
 */
export function formatDocumentsForStorage(
  result: GenerateDocumentsResult,
  meta: {
    sessionId: string;
    projectId: string;
    userId: string;
    version?: number;
  },
): DocumentInsert[] {
  const version = meta.version ?? 1;
  return (Object.keys(RESULT_TO_DOC_TYPE) as Array<keyof GenerateDocumentsResult>)
    .map((key) => {
      const docType = RESULT_TO_DOC_TYPE[key];
      const title = DOC_META[docType].title;
      return {
        session_id: meta.sessionId,
        project_id: meta.projectId,
        user_id: meta.userId,
        doc_type: docType,
        title,
        content: formatMarkdown(result[key], title),
        structured_content: null,
        version,
      };
    });
}

/**
 * Group document rows into a frontend-friendly map.
 */
export function documentsToMap(
  docs: Pick<GeneratedDocument, "doc_type" | "content" | "id" | "title" | "version">[],
): Record<string, { id: string; title: string; content: string; version: number }> {
  const map: Record<
    string,
    { id: string; title: string; content: string; version: number }
  > = {};
  for (const doc of docs) {
    map[doc.doc_type] = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      version: doc.version,
    };
  }
  return map;
}
