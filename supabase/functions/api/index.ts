/**
 * ARIA REST API — single Edge Function router.
 *
 * Routes:
 *   POST   /projects
 *   GET    /projects
 *   GET    /projects/:id
 *   POST   /sessions/start
 *   POST   /sessions/message
 *   POST   /sessions/complete
 *   GET    /sessions/:id
 *   POST   /documents/generate
 *   GET    /documents/:id
 *
 * Invoke via: POST/GET {SUPABASE_URL}/functions/v1/api/<path>
 * Auth: Authorization: Bearer <supabase_access_token>
 */

import { handleCors } from "../_shared/cors.ts";
import { fail, ok, readJson } from "../_shared/http.ts";
import { AuthError, requireAuth } from "../_shared/supabase.ts";
import {
  HttpError,
  completeSession,
  createProject,
  generateDocuments,
  getDocument,
  getProject,
  getSession,
  listProjects,
  postSessionMessage,
  startSession,
} from "../_shared/handlers.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { admin, userId } = await requireAuth(req);
    const url = new URL(req.url);
    // Path after /api — supports both /functions/v1/api/... and local serve
    const path = normalizePath(url.pathname);
    const method = req.method.toUpperCase();

    // ----- Projects -----
    if (method === "POST" && path === "/projects") {
      const body = await readJson<{
        clientName: string;
        projectName: string;
        industry?: string;
        brief?: string;
        attachments?: string[];
      }>(req);
      const project = await createProject(admin, userId, body);
      return ok(project, 201);
    }

    if (method === "GET" && path === "/projects") {
      const projects = await listProjects(admin, userId);
      return ok(projects);
    }

    const projectMatch = path.match(/^\/projects\/([^/]+)$/);
    if (method === "GET" && projectMatch) {
      const project = await getProject(admin, userId, projectMatch[1]!);
      return ok(project);
    }

    // ----- Sessions -----
    if (method === "POST" && path === "/sessions/start") {
      const body = await readJson<{ projectId: string; brief?: string }>(req);
      const result = await startSession(admin, userId, body);
      return ok(result, 201);
    }

    if (method === "POST" && path === "/sessions/message") {
      const body = await readJson<{ sessionId: string; content: string }>(req);
      const result = await postSessionMessage(admin, userId, body);
      return ok(result);
    }

    if (method === "POST" && path === "/sessions/complete") {
      const body = await readJson<{ sessionId: string }>(req);
      const result = await completeSession(admin, userId, body);
      return ok(result);
    }

    const sessionMatch = path.match(/^\/sessions\/([^/]+)$/);
    if (method === "GET" && sessionMatch) {
      const result = await getSession(admin, userId, sessionMatch[1]!);
      return ok(result);
    }

    // ----- Documents -----
    if (method === "POST" && path === "/documents/generate") {
      const body = await readJson<{ sessionId: string }>(req);
      const result = await generateDocuments(admin, userId, body);
      return ok(result, 201);
    }

    const docMatch = path.match(/^\/documents\/([^/]+)$/);
    if (method === "GET" && docMatch) {
      const doc = await getDocument(admin, userId, docMatch[1]!);
      return ok(doc);
    }

    return fail(`Not found: ${method} ${path}`, 404);
  } catch (err) {
    return toErrorResponse(err);
  }
});

function normalizePath(pathname: string): string {
  // Strip function prefix variants
  let path = pathname
    .replace(/^\/functions\/v1\/api/, "")
    .replace(/^\/api/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

function toErrorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return fail(err.message, err.status);
  }
  if (err instanceof HttpError) {
    return fail(err.message, err.status, err.details);
  }
  if (err instanceof Error && err.message === "Invalid JSON body") {
    return fail(err.message, 400);
  }
  console.error("API error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return fail(message, 500);
}
