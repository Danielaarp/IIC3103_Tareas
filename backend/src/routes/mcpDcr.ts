import "dotenv/config";
import { Router } from "express";
import { getAuthenticatedSession } from "../auth/session.js";
import {
  temporaryCookieClearOptions,
  temporaryCookieOptions,
} from "../config/cookies.js";
import { supabase } from "../database/supabase.js";
import { generatePkce } from "../oauth/pkce.js";
import {
  decryptText,
  encryptText,
} from "../security/encryption.js";
import { requireEnvironmentVariable } from "../utils/env.js";

const router = Router();

const publicAppUrl = requireEnvironmentVariable("PUBLIC_APP_URL");
const appOrigin = new URL(publicAppUrl).origin;
const redirectUri = `${appOrigin}/api/mcp/dcr/callback`;

const mcpResource =
  "https://tarea1-mcp-dcr-z2fqxmm2ja-uc.a.run.app/mcp";

const registrationUrl =
  "https://tarea1-auth-z2fqxmm2ja-uc.a.run.app/realms/dcr/register";

const authorizationUrl =
  "https://tarea1-auth-z2fqxmm2ja-uc.a.run.app/realms/dcr/authorize";

const tokenUrl = "https://tarea1-auth-z2fqxmm2ja-uc.a.run.app/realms/dcr/token";

const dcrCookieOptions = temporaryCookieOptions();
const dcrCookieClearOptions =
  temporaryCookieClearOptions();

router.get("/connect", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión",
      });
      return;
    }

    const { data: sessionData, error: sessionError } =
      await supabase
        .from("sessions")
        .select(
          "login_access_token_encrypted, oauth_token_expires_at",
        )
        .eq("id", session.sessionId)
        .single();

    if (sessionError || !sessionData) {
      response.status(401).json({
        error: "No fue posible recuperar la sesión OAuth",
      });
      return;
    }

    if (!sessionData.login_access_token_encrypted) {
      response.status(401).json({
        error: "La sesión no contiene el token de login",
      });
      return;
    }

    if (
      sessionData.oauth_token_expires_at &&
      new Date(sessionData.oauth_token_expires_at) <= new Date()
    ) {
      response.status(401).json({
        error: "El token de login venció. Cierra sesión e ingresa nuevamente.",
      });
      return;
    }

    const loginAccessToken = decryptText(
      sessionData.login_access_token_encrypted,
    );

    const registrationResponse = await fetch(registrationUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: "IntegraTrip - StayWell",
        redirect_uris: [redirectUri],
        grant_types: [
          "authorization_code",
          "refresh_token",
        ],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
      }),
    });

    if (!registrationResponse.ok) {
      const body = await registrationResponse.text();
      console.error("Error registrando cliente DCR:", body);

      response.status(502).json({
        error: "No fue posible registrar el cliente DCR",
      });
      return;
    }

    const registration = (await registrationResponse.json()) as {
      client_id?: string;
      client_secret?: string;
    };

    if (!registration.client_id || !registration.client_secret) {
      response.status(502).json({
        error: "El registro DCR no entregó credenciales",
      });
      return;
    }

    const {
      state,
      codeVerifier,
      codeChallenge,
    } = generatePkce();

    response.cookie(
      "oauth_dcr_state",
      state,
      dcrCookieOptions,
    );

    response.cookie(
      "oauth_dcr_verifier",
      codeVerifier,
      dcrCookieOptions,
    );

    response.cookie(
      "oauth_dcr_client_id",
      registration.client_id,
      dcrCookieOptions,
    );

    response.cookie(
      "oauth_dcr_client_secret",
      encryptText(registration.client_secret),
      dcrCookieOptions,
    );

    const authorize = new URL(authorizationUrl);

    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set(
      "client_id",
      registration.client_id,
    );
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("scope", "mcp:tools");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set(
      "code_challenge",
      codeChallenge,
    );
    authorize.searchParams.set(
      "code_challenge_method",
      "S256",
    );
    authorize.searchParams.set("resource", mcpResource);

    response.redirect(authorize.toString());
  } catch (error) {
    console.error("Error iniciando DCR:", error);

    response.status(500).json({
      error: "No fue posible iniciar la conexión DCR",
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

    const code =
      typeof request.query.code === "string"
        ? request.query.code
        : undefined;

    const returnedState =
      typeof request.query.state === "string"
        ? request.query.state
        : undefined;

    const expectedState = request.cookies.oauth_dcr_state as
      | string
      | undefined;

    const codeVerifier =
      request.cookies.oauth_dcr_verifier as
        | string
        | undefined;

    const clientId = request.cookies.oauth_dcr_client_id as
      | string
      | undefined;

    const encryptedClientSecret =
      request.cookies.oauth_dcr_client_secret as
        | string
        | undefined;

    if (
      !code ||
      !returnedState ||
      !expectedState ||
      !codeVerifier ||
      !clientId ||
      !encryptedClientSecret ||
      returnedState !== expectedState
    ) {
      response.status(400).json({
        error: "Callback OAuth DCR inválido",
      });
      return;
    }

    const clientSecret = decryptText(
      encryptedClientSecret,
    );

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
      const body = await tokenResponse.text();
      console.error("Error obteniendo token DCR:", body);

      response.status(502).json({
        error: "No fue posible obtener el token DCR",
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
        error: "El servidor DCR no entregó access token",
      });
      return;
    }

    const tokenExpiration = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    ).toISOString();
console.log("Guardando conexión MCP dcr:", {
  userId: session.userId,
  resource: mcpResource,
});
    const { error } = await supabase
      .from("mcp_connections")
      .upsert(
        {
          user_id: session.userId,
          name: "StayWell",
          server_url: mcpResource,
          auth_method: "DCR",
          access_token_encrypted: encryptText(
            tokenData.access_token,
          ),
          refresh_token_encrypted: tokenData.refresh_token
            ? encryptText(tokenData.refresh_token)
            : null,
          token_expires_at: tokenExpiration,
          client_id: clientId,
          client_secret_encrypted:
            encryptedClientSecret,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,server_url",
        },
      );

    if (error) {
        console.error("Error guardando DCR:", error);
      response.status(500).json({
        error: "No fue posible guardar StayWell",
      });
      return;
    }

    for (const cookieName of [
      "oauth_dcr_state",
      "oauth_dcr_verifier",
      "oauth_dcr_client_id",
      "oauth_dcr_client_secret",
    ]) {
      response.clearCookie(
        cookieName,
        dcrCookieClearOptions,
      );
    }

    response.redirect(`${appOrigin}/dashboard?connected=dcr`);
  } catch (error) {
    console.error("Error completando DCR:", error);

    response.status(500).json({
      error: "Error interno completando DCR",
    });
  }
});

export default router;