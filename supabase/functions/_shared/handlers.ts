/**
 * Domain handlers for ARIA REST API.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  runAnalyzeBrief,
  runContinueConversation,
  runGenerateDocuments,
} from "./ai-service.ts";
import { formatDocumentsForStorage, documentsToMap } from "./document-formatter.ts";
import {
  computeProgress,
  emptyAskedCount,
  emptyRequirements,
  type Ambiguity,
  type Project,
  type Requirements,
  type SectionKey,
  type Session,
} from "./types.ts";

function mergePartialRequirements(
  base: Requirements,
  partial: Partial<Requirements>,
): Requirements {
  const next: Requirements = { ...emptyRequirements(), ...base };
  for (const key of Object.keys(partial) as SectionKey[]) {
    const items = partial[key];
    if (items?.length) next[key] = items;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(
  admin: SupabaseClient,
  userId: string,
  body: {
    clientName: string;
    projectName: string;
    industry?: string;
    brief?: string;
    attachments?: string[];
  },
): Promise<Project> {
  if (!body.clientName?.trim() || !body.projectName?.trim()) {
    throw new HttpError(400, "clientName and projectName are required");
  }

  const { data, error } = await admin
    .from("projects")
    .insert({
      user_id: userId,
      client_name: body.clientName.trim(),
      project_name: body.projectName.trim(),
      industry: body.industry?.trim() ?? "",
      brief: body.brief?.trim() ?? "",
      attachments: body.attachments ?? [],
      status: "draft",
    })
    .select()
    .single();

  if (error) throw new HttpError(500, error.message);
  return data as Project;
}

export async function listProjects(
  admin: SupabaseClient,
  userId: string,
): Promise<Project[]> {
  const { data, error } = await admin
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new HttpError(500, error.message);
  return (data ?? []) as Project[];
}

export async function getProject(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<Project & { sessions?: Session[] }> {
  const { data: project, error } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!project) throw new HttpError(404, "Project not found");

  const { data: sessions, error: sErr } = await admin
    .from("sessions")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (sErr) throw new HttpError(500, sErr.message);

  return { ...(project as Project), sessions: (sessions ?? []) as Session[] };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function startSession(
  admin: SupabaseClient,
  userId: string,
  body: {
    projectId: string;
    /** Optional overrides if project brief should be re-analyzed with tweaks */
    brief?: string;
  },
) {
  if (!body.projectId) throw new HttpError(400, "projectId is required");

  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("*")
    .eq("id", body.projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (pErr) throw new HttpError(500, pErr.message);
  if (!project) throw new HttpError(404, "Project not found");

  const brief = (body.brief ?? project.brief ?? "").trim();
  if (!brief) {
    throw new HttpError(400, "A client brief is required to start a session");
  }

  // Run AI analysis on the brief
  const analysis = await runAnalyzeBrief({
    clientName: project.client_name,
    projectName: project.project_name,
    industry: project.industry ?? "",
    brief,
  });

  const requirements = mergePartialRequirements(
    emptyRequirements(),
    analysis.extractedRequirements,
  );
  const progress = computeProgress(requirements);

  const { data: session, error: sErr } = await admin
    .from("sessions")
    .insert({
      project_id: project.id,
      user_id: userId,
      status: "in_progress",
      requirements,
      missing_categories: analysis.missingCategories,
      ambiguities: [],
      progress,
      current_section: analysis.firstQuestionSection,
      asked_count: emptyAskedCount(),
    })
    .select()
    .single();

  if (sErr) throw new HttpError(500, sErr.message);

  // Persist project brief/status if updated
  await admin
    .from("projects")
    .update({
      brief,
      status: "in_progress",
    })
    .eq("id", project.id);

  const intro =
    analysis.summary
      ? `${analysis.summary}\n\n**${analysis.firstQuestionSection}**\n\n${analysis.firstQuestion}`
      : analysis.firstQuestion;

  const { data: message, error: mErr } = await admin
    .from("messages")
    .insert({
      session_id: session.id,
      role: "assistant",
      content: intro,
      section: analysis.firstQuestionSection,
      metadata: { kind: "first_question", analysisSummary: analysis.summary },
    })
    .select()
    .single();

  if (mErr) throw new HttpError(500, mErr.message);

  return {
    session,
    message,
    analysis: {
      missingCategories: analysis.missingCategories,
      firstQuestionSection: analysis.firstQuestionSection,
      summary: analysis.summary,
      progress,
    },
  };
}

export async function postSessionMessage(
  admin: SupabaseClient,
  userId: string,
  body: { sessionId: string; content: string },
) {
  if (!body.sessionId) throw new HttpError(400, "sessionId is required");
  const content = body.content?.trim();
  if (!content) throw new HttpError(400, "content is required");

  const { data: session, error: sErr } = await admin
    .from("sessions")
    .select("*")
    .eq("id", body.sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sErr) throw new HttpError(500, sErr.message);
  if (!session) throw new HttpError(404, "Session not found");
  if (session.status === "completed" || session.status === "documents_ready") {
    throw new HttpError(409, "Session is already complete");
  }

  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("*")
    .eq("id", session.project_id)
    .maybeSingle();

  if (pErr) throw new HttpError(500, pErr.message);
  if (!project) throw new HttpError(404, "Project not found");

  // Store user message
  const { data: userMsg, error: uErr } = await admin
    .from("messages")
    .insert({
      session_id: session.id,
      role: "user",
      content,
      section: session.current_section,
    })
    .select()
    .single();

  if (uErr) throw new HttpError(500, uErr.message);

  const { data: recent, error: rErr } = await admin
    .from("messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (rErr) throw new HttpError(500, rErr.message);

  const result = await runContinueConversation({
    clientName: project.client_name,
    projectName: project.project_name,
    industry: project.industry ?? "",
    brief: project.brief ?? "",
    requirements: session.requirements as Requirements,
    missingCategories: (session.missing_categories ?? []) as SectionKey[],
    ambiguities: (session.ambiguities ?? []) as Ambiguity[],
    userMessage: content,
    recentMessages: (recent ?? []) as Array<{ role: string; content: string }>,
  });

  const askedCount = {
    ...emptyAskedCount(),
    ...(session.asked_count as Record<string, number>),
  };
  if (result.nextQuestionSection) {
    askedCount[result.nextQuestionSection] =
      (askedCount[result.nextQuestionSection] ?? 0) + 1;
  }

  const newStatus = result.intakeComplete ? "completed" : "in_progress";

  const { data: updatedSession, error: upErr } = await admin
    .from("sessions")
    .update({
      requirements: result.updatedRequirements,
      missing_categories: result.missingCategories,
      ambiguities: result.ambiguities,
      progress: result.progress,
      current_section: result.currentSection,
      asked_count: askedCount,
      status: newStatus,
      completed_at: result.intakeComplete ? new Date().toISOString() : null,
    })
    .eq("id", session.id)
    .select()
    .single();

  if (upErr) throw new HttpError(500, upErr.message);

  const { data: assistantMsg, error: aErr } = await admin
    .from("messages")
    .insert({
      session_id: session.id,
      role: "assistant",
      content: result.assistantMessage,
      section: result.nextQuestionSection,
      metadata: {
        ambiguities: result.ambiguities,
        contradictions: result.contradictions,
        intakeComplete: result.intakeComplete,
      },
    })
    .select()
    .single();

  if (aErr) throw new HttpError(500, aErr.message);

  return {
    session: updatedSession,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    progress: result.progress,
    missingCategories: result.missingCategories,
    ambiguities: result.ambiguities,
    contradictions: result.contradictions,
    intakeComplete: result.intakeComplete,
  };
}

export async function completeSession(
  admin: SupabaseClient,
  userId: string,
  body: { sessionId: string },
) {
  if (!body.sessionId) throw new HttpError(400, "sessionId is required");

  const { data: session, error } = await admin
    .from("sessions")
    .select("*")
    .eq("id", body.sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!session) throw new HttpError(404, "Session not found");

  const { data: updated, error: uErr } = await admin
    .from("sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      progress: Math.max(session.progress ?? 0, computeProgress(session.requirements as Requirements)),
    })
    .eq("id", session.id)
    .select()
    .single();

  if (uErr) throw new HttpError(500, uErr.message);

  const { data: message } = await admin
    .from("messages")
    .insert({
      session_id: session.id,
      role: "assistant",
      content:
        "Intake marked complete. You can generate the BRD, SRS, user stories, acceptance criteria and client summary whenever you're ready.",
      metadata: { kind: "session_complete" },
    })
    .select()
    .single();

  return { session: updated, message };
}

export async function getSession(
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { data: session, error } = await admin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!session) throw new HttpError(404, "Session not found");

  const { data: messages, error: mErr } = await admin
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (mErr) throw new HttpError(500, mErr.message);

  const { data: documents, error: dErr } = await admin
    .from("generated_documents")
    .select("*")
    .eq("session_id", sessionId)
    .order("version", { ascending: false });

  if (dErr) throw new HttpError(500, dErr.message);

  // Keep latest version per doc_type
  const latestByType = new Map<string, (typeof documents)[number]>();
  for (const doc of documents ?? []) {
    if (!latestByType.has(doc.doc_type)) latestByType.set(doc.doc_type, doc);
  }

  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("id", session.project_id)
    .maybeSingle();

  return {
    session,
    project,
    messages: messages ?? [],
    documents: [...latestByType.values()],
    documentsMap: documentsToMap([...latestByType.values()]),
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function generateDocuments(
  admin: SupabaseClient,
  userId: string,
  body: { sessionId: string },
) {
  if (!body.sessionId) throw new HttpError(400, "sessionId is required");

  const { data: session, error } = await admin
    .from("sessions")
    .select("*")
    .eq("id", body.sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!session) throw new HttpError(404, "Session not found");

  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("*")
    .eq("id", session.project_id)
    .maybeSingle();

  if (pErr) throw new HttpError(500, pErr.message);
  if (!project) throw new HttpError(404, "Project not found");

  const generated = await runGenerateDocuments({
    clientName: project.client_name,
    projectName: project.project_name,
    industry: project.industry ?? "",
    brief: project.brief ?? "",
    requirements: session.requirements as Requirements,
    ambiguities: (session.ambiguities ?? []) as Ambiguity[],
  });

  // Next version = max existing + 1
  const { data: existing } = await admin
    .from("generated_documents")
    .select("version")
    .eq("session_id", session.id)
    .order("version", { ascending: false })
    .limit(1);

  const version = ((existing?.[0]?.version as number | undefined) ?? 0) + 1;

  const rows = formatDocumentsForStorage(generated, {
    sessionId: session.id,
    projectId: project.id,
    userId,
    version,
  });

  const { data: inserted, error: iErr } = await admin
    .from("generated_documents")
    .insert(rows)
    .select();

  if (iErr) throw new HttpError(500, iErr.message);

  await admin
    .from("sessions")
    .update({ status: "documents_ready" })
    .eq("id", session.id);

  await admin
    .from("projects")
    .update({ status: "documents_ready" })
    .eq("id", project.id);

  return {
    sessionId: session.id,
    version,
    documents: inserted,
    documentsMap: documentsToMap(inserted ?? []),
  };
}

export async function getDocument(
  admin: SupabaseClient,
  userId: string,
  documentId: string,
) {
  const { data, error } = await admin
    .from("generated_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Document not found");
  return data;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
