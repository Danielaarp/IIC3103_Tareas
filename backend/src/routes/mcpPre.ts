import "dotenv/config";
import { Router } from "express";
import { getAuthenticatedSession } from "../auth/session.js";
import { supabase } from "../database/supabase.js";
import {requireEnvironmentVariable} from "../utils/env.js";
import { encryptText } from "../security/encryption.js";
import { generatePkce } from "../oauth/pkce.js";

import {temporaryCookieClearOptions,temporaryCookieOptions,} from "../config/cookies.js";


const router = Router();

const authorizationUrl = requireEnvironmentVariable( "AUTH_AUTHORIZATION_URL",);
const tokenUrl = requireEnvironmentVariable("AUTH_TOKEN_URL");
const clientId = requireEnvironmentVariable("PRE_CLIENT_ID");
const clientSecret = requireEnvironmentVariable("PRE_CLIENT_SECRET");
const publicAppUrl = requireEnvironmentVariable("PUBLIC_APP_URL");
const mcpResource = requireEnvironmentVariable("MCP_RESOURCE");


const appOrigin = new URL(publicAppUrl).origin;
const redirectUri = `${appOrigin}/api/mcp/pre/callback`;



const callbackPath = "/api/mcp/pre/callback";

const preCookieOptions = temporaryCookieOptions();
const preCookieClearOptions =
  temporaryCookieClearOptions();

router.get("/connect", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({error: "Debes iniciar sesión antes de conectar un MCP",});
      return;}

    const {
    state,
    codeVerifier,
    codeChallenge,
    } = generatePkce();

    response.cookie("oauth_pre_state",state, preCookieOptions, );

    response.cookie("oauth_pre_verifier",codeVerifier,preCookieOptions,);

    const authorize = new URL(authorizationUrl);

    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("scope", "mcp:tools");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", codeChallenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("resource", mcpResource);

    response.redirect(authorize.toString());} catch (error) {
    console.error("Error iniciando conexión PRE:", error);

    response.status(500).json({
      error: "No fue posible iniciar la conexión con Andes Air",
    });
  }
});

router.get("/callback", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "La sesión de IntegraTrip no es válida",});
        return; }

    const code =
      typeof request.query.code === "string"
        ? request.query.code
        : undefined;

    const returnedState =
      typeof request.query.state === "string"
        ? request.query.state
        : undefined;

    const expectedState = request.cookies.oauth_pre_state as
      | string
      | undefined;

    const codeVerifier = request.cookies.oauth_pre_verifier as
      | string
      | undefined;

    if (
      !code ||
      !returnedState ||
      !expectedState ||
      !codeVerifier ||
      returnedState !== expectedState
    ) {
      response.status(400).json({error: "Callback OAuth PRE inválido",
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
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
        resource: mcpResource,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("Error obteniendo token PRE:", errorBody);

      response.status(502).json({
        error: "No fue posible obtener autorización para Andes Air",
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
        error: "El servidor no entregó un access token",
      });
      return;
    }

    const tokenExpiration = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    ).toISOString();

    const { error: connectionError } = await supabase
      .from("mcp_connections")
      .upsert(
        {
          user_id: session.userId,
          name: "Andes Air",
          server_url: mcpResource,
          auth_method: "PRE",
          access_token_encrypted: encryptText(
            tokenData.access_token,
          ),
          refresh_token_encrypted: tokenData.refresh_token
            ? encryptText(tokenData.refresh_token)
            : null,
          token_expires_at: tokenExpiration,
          client_id: clientId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,server_url",
        },
      );

    if (connectionError) {
      console.error(
        "Error guardando conexión PRE:",
        connectionError,
      );

      response.status(500).json({
        error: "No fue posible guardar la conexión con Andes Air",
      });
      return;
    }

    response.clearCookie(
      "oauth_pre_state",
      preCookieClearOptions,
    );

    response.clearCookie(
      "oauth_pre_verifier",
      preCookieClearOptions,
    );

    response.redirect(`${appOrigin}/dashboard?connected=pre`);
  } catch (error) {
    console.error("Error completando conexión PRE:", error);

    response.status(500).json({
      error: "Error interno conectando Andes Air",
    });
  }
});

export default router;