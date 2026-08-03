/**
 * Edge Function: continueConversation
 *
 * Update requirements from the latest user reply, detect ambiguity /
 * contradictions, ask the next-best question, return progress.
 *
 * POST body:
 * {
 *   clientName, projectName, industry?, brief?,
 *   requirements: Requirements,
 *   missingCategories?: SectionKey[],
 *   ambiguities?: Ambiguity[],
 *   userMessage: string,
 *   recentMessages?: { role, content }[]
 * }
 */

import { handleCors } from "../_shared/cors.ts";
import { fail, ok, readJson } from "../_shared/http.ts";
import { AuthError, requireAuth } from "../_shared/supabase.ts";
import { runContinueConversation } from "../_shared/ai-service.ts";
import {
  emptyRequirements,
  type Ambiguity,
  type Requirements,
  type SectionKey,
} from "../_shared/types.ts";

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
      brief?: string;
      requirements?: Requirements;
      missingCategories?: SectionKey[];
      ambiguities?: Ambiguity[];
      userMessage: string;
      recentMessages?: Array<{ role: string; content: string }>;
    }>(req);

    if (!body.userMessage?.trim()) {
      return fail("userMessage is required", 400);
    }
    if (!body.clientName?.trim() || !body.projectName?.trim()) {
      return fail("clientName and projectName are required", 400);
    }

    const result = await runContinueConversation({
      clientName: body.clientName.trim(),
      projectName: body.projectName.trim(),
      industry: body.industry?.trim() ?? "",
      brief: body.brief?.trim() ?? "",
      requirements: body.requirements ?? emptyRequirements(),
      missingCategories: body.missingCategories ?? [],
      ambiguities: body.ambiguities ?? [],
      userMessage: body.userMessage.trim(),
      recentMessages: body.recentMessages ?? [],
    });

    return ok(result);
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.status);
    console.error("continueConversation error:", err);
    return fail(err instanceof Error ? err.message : "Internal error", 500);
  }
});
