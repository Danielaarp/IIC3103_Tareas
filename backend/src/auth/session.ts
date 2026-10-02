import "dotenv/config";
import type { Request } from "express";
import { supabase } from "../database/supabase.js";
import { hashValue } from "../security/hashing.js";

interface AuthenticatedSession {sessionId: string;userId: string;}


export async function getAuthenticatedSession(request: Request,
): Promise<AuthenticatedSession | null> {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "integratrip_session";

  const sessionToken = request.cookies[cookieName] as
    | string
    | undefined;

  if (!sessionToken) { return null;}
  // devuelve la sesión si el token es válido y no ha expirado. si no, devuelve null en caso de error o si no se encuentra la sesión 
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id, expires_at")
    .eq("token_hash", hashValue(sessionToken))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(`Error consultando sesión: ${error.message}`);
  }

  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.user_id,
  };
}