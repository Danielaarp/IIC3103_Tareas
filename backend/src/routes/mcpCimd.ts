import { Router } from "express";
import { requireEnvironmentVariable } from "../utils/env.js";

import { getAuthenticatedSession } from "../auth/session.js";
import { generatePkce } from "../oauth/pkce.js";
import { temporaryCookieOptions } from "../config/cookies.js";

import { supabase } from "../database/supabase.js";
import { encryptText } from "../security/encryption.js";
import { temporaryCookieClearOptions } from "../config/cookies.js";
const router = Router();

const publicAppUrl = requireEnvironmentVariable("PUBLIC_APP_URL");
const appOrigin = new URL(publicAppUrl).origin;

const clientId = `${appOrigin}/api/mcp/cimd/metadata.json`;
const redirectUri = `${appOrigin}/api/mcp/cimd/callback`;

const authorizationUrl ="https://tarea1-auth-z2fqxmm2ja-uc.a.run.app/realms/cimd/authorize";

const mcpResource = requireEnvironmentVariable("MCP_RESOURCE");
const tokenUrl =  "https://tarea1-auth-z2fqxmm2ja-uc.a.run.app/realms/cimd/token";


router.get("/metadata.json", (_request, response) => {
  response.json({
    client_id: clientId,
    client_name: "IntegraTrip - Cielo Sur",
    client_uri: appOrigin,
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});


router.get("/connect", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión antes de conectar Cielo Sur",
      });
      return;
    }

    const {
      state,
      codeVerifier,
      codeChallenge,
    } = generatePkce();

    response.cookie(
      "oauth_cimd_state",
      state,
      temporaryCookieOptions(),
    );

    response.cookie(
      "oauth_cimd_verifier",
      codeVerifier,
      temporaryCookieOptions(),
    );

    const authorize = new URL(authorizationUrl);

    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("scope", "mcp:tools");
    authorize.searchParams.set("resource", mcpResource);

    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", codeChallenge);
    authorize.searchParams.set("code_challenge_method", "S256");

    response.redirect(authorize.toString());
  } catch (error) {
    console.error("Error iniciando CIMD:", error);

    response.status(500).json({
      error: "No fue posible iniciar la conexión con Cielo Sur",
    });
  }
});


router.get("/callback", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "La sesión de IntegraTrip no es válida",
      });
      return;
    }

    const code = request.query.code;
    const returnedState = request.query.state;

    const expectedState = request.cookies.oauth_cimd_state;
    const codeVerifier = request.cookies.oauth_cimd_verifier;

    if (
      typeof code !== "string" ||
      !code ||
      typeof returnedState !== "string" ||
      !returnedState ||
      typeof expectedState !== "string" ||
      returnedState !== expectedState ||
      typeof codeVerifier !== "string" ||
      !codeVerifier
    ) {
      response.status(400).json({
        error: "Callback OAuth CIMD inválido",
      });
      return;
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        resource: mcpResource,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!tokenResponse.ok) {
      console.error(
        "Intercambio CIMD rechazado:",
        tokenResponse.status,
      );

      response.status(502).json({
        error: "No fue posible obtener el token de Cielo Sur",
      });
      return;
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      response.status(502).json({
        error: "Cielo Sur no entregó un access token",
      });
      return;
    }

    const tokenExpiration = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    ).toISOString();

    const { error } = await supabase
      .from("mcp_connections")
      .upsert(
        {
          user_id: session.userId,
          name: "Cielo Sur",
          server_url: mcpResource,
          auth_method: "CIMD",
          client_id: clientId,

          access_token_encrypted: encryptText(
            tokenData.access_token,
          ),

          refresh_token_encrypted: tokenData.refresh_token
            ? encryptText(tokenData.refresh_token)
            : null,

          token_expires_at: tokenExpiration,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,server_url",
        },
      );

    if (error) {
      console.error("Error guardando conexión CIMD:", error);

      response.status(500).json({
        error: "No fue posible guardar Cielo Sur",
      });
      return;
    }

    response.clearCookie(
      "oauth_cimd_state",
      temporaryCookieClearOptions(),
    );

    response.clearCookie(
      "oauth_cimd_verifier",
      temporaryCookieClearOptions(),
    );

    response.redirect(
      `${appOrigin}/dashboard?connected=cimd`,
    );
  } catch (error) {
    console.error("Error completando CIMD:", error);

    response.status(500).json({
      error: "Error interno durante la conexión con Cielo Sur",
    });
  }
});

export default router;