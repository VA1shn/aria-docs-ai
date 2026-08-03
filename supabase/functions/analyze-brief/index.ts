/**
 * Edge Function: analyzeBrief
 *
 * Extract requirements from a client brief, detect missing categories,
 * and generate the first follow-up question.
 *
 * POST body:
 * {
 *   clientName: string
 *   projectName: string
 *   industry?: string
 *   brief: string
 * }
 */

import { handleCors } from "../_shared/cors.ts";
import { fail, ok, readJson } from "../_shared/http.ts";
import { AuthError, requireAuth } from "../_shared/supabase.ts";
import { runAnalyzeBrief } from "../_shared/ai-service.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return fail("Method not allowed", 405);
  }

  try {
    await requireAuth(req);
    const body = await readJson<{
      clientName: string;
      projectName: string;
      industry?: string;
      brief: string;
    }>(req);

    if (!body.brief?.trim()) {
      return fail("brief is required", 400);
    }
    if (!body.clientName?.trim() || !body.projectName?.trim()) {
      return fail("clientName and projectName are required", 400);
    }

    const result = await runAnalyzeBrief({
      clientName: body.clientName.trim(),
      projectName: body.projectName.trim(),
      industry: body.industry?.trim() ?? "",
      brief: body.brief.trim(),
    });

    return ok(result);
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.status);
    console.error("analyzeBrief error:", err);
    return fail(err instanceof Error ? err.message : "Internal error", 500);
  }
});
