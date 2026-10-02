import { Router } from "express";
import { requireEnvironmentVariable } from "../utils/env.js";

import { getAuthenticatedSession } from "../auth/session.js";
import { generatePkce } from "../oauth/pkce.js";
import { temporaryCookieOptions } from "../config/cookies.js";

const router = Router();

const publicAppUrl = requireEnvironmentVariable("PUBLIC_APP_URL");
const appOrigin = new URL(publicAppUrl).origin;

const clientId = `${appOrigin}/api/mcp/cimd/metadata.json`;
const redirectUri = `${appOrigin}/api/mcp/cimd/callback`;

const authorizationUrl ="https://tarea1-auth-z2fqxmm2ja-uc.a.run.app/realms/cimd/authorize";

const mcpResource = "https://tarea1-mcp-cimd-z2fqxmm2ja-uc.a.run.app/mcp";

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

export default router;