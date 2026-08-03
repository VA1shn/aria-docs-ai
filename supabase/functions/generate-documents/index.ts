/**
 * Edge Function: generateDocuments
 *
 * Generate BRD, SRS, User Stories, Acceptance Criteria, and Client Summary
 * from structured requirements (does not persist — use POST /documents/generate
 * on the api function to store them).
 *
 * POST body:
 * {
 *   clientName, projectName, industry?, brief?,
 *   requirements: Requirements,
 *   ambiguities?: Ambiguity[]
 * }
 */

import { handleCors } from "../_shared/cors.ts";
import { fail, ok, readJson } from "../_shared/http.ts";
import { AuthError, requireAuth } from "../_shared/supabase.ts";
import { runGenerateDocuments } from "../_shared/ai-service.ts";
import {
  emptyRequirements,
  type Ambiguity,
  type Requirements,
} from "../_shared/types.ts";
import { DOC_META, RESULT_TO_DOC_TYPE, formatMarkdown } from "../_shared/document-formatter.ts";

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
      ambiguities?: Ambiguity[];
    }>(req);

    if (!body.clientName?.trim() || !body.projectName?.trim()) {
      return fail("clientName and projectName are required", 400);
    }

    const result = await runGenerateDocuments({
      clientName: body.clientName.trim(),
      projectName: body.projectName.trim(),
      industry: body.industry?.trim() ?? "",
      brief: body.brief?.trim() ?? "",
      requirements: body.requirements ?? emptyRequirements(),
      ambiguities: body.ambiguities ?? [],
    });

    // Also return a typed map with titles for convenience
    const documents = (
      Object.keys(RESULT_TO_DOC_TYPE) as Array<keyof typeof RESULT_TO_DOC_TYPE>
    ).map((key) => {
      const docType = RESULT_TO_DOC_TYPE[key];
      return {
        docType,
        title: DOC_META[docType].title,
        content: formatMarkdown(result[key], DOC_META[docType].title),
      };
    });

    return ok({ ...result, documents });
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.status);
    console.error("generateDocuments error:", err);
    return fail(err instanceof Error ? err.message : "Internal error", 500);
  }
});
