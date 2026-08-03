/**
 * JSON response helpers.
 */

import { corsHeaders } from "./cors.ts";

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function ok<T>(data: T, status = 200): Response {
  return jsonResponse({ ok: true, data }, status);
}

export function fail(
  error: string,
  status = 400,
  details?: unknown,
): Response {
  return jsonResponse(
    { ok: false, error, ...(details !== undefined ? { details } : {}) },
    status,
  );
}

export async function readJson<T = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
