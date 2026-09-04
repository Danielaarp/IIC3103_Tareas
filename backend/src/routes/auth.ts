import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { Router, type CookieOptions } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { supabase } from "../database/supabase.js";
import { encryptText } from "../security/encryption.js";



const router = Router();

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;}


//variables de entorno necesarias para la autenticación OAuth
const authorizationUrl = requireEnvironmentVariable("AUTH_AUTHORIZATION_URL",);
const tokenUrl = requireEnvironmentVariable("AUTH_TOKEN_URL");
const issuerUrl = requireEnvironmentVariable("AUTH_ISSUER_URL");
const jwksUrl = requireEnvironmentVariable("AUTH_JWKS_URL");
const clientId = requireEnvironmentVariable("PRE_CLIENT_ID");
const clientSecret = requireEnvironmentVariable("PRE_CLIENT_SECRET");
const publicAppUrl = requireEnvironmentVariable("PUBLIC_APP_URL");
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "integratrip_session";
const appOrigin = new URL(publicAppUrl).origin;
const redirectUri = `${appOrigin}/api/auth/callback`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));
const isProduction = process.env.NODE_ENV === "production";

const temporaryCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/auth/callback",
  maxAge: 10 * 60 * 1000,
};

const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
};

const sessionCookieClearOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
// rutas para el flujo de autenticación OAuth
router.get("/login", (_request, response) => {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  response.cookie("oauth_login_state", state, temporaryCookieOptions);
  response.cookie("oauth_login_verifier",codeVerifier,temporaryCookieOptions,);
  const authorize = new URL(authorizationUrl);

  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "mcp:tools");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("resource", appOrigin);
  authorize.searchParams.set("prompt", "login");

  response.redirect(authorize.toString());
});

router.get("/callback", async (request, response) => {
  try {
    const code =
      typeof request.query.code === "string"
        ? request.query.code
        : undefined;

    const returnedState =
      typeof request.query.state === "string"
        ? request.query.state
        : undefined;

    const expectedState = request.cookies.oauth_login_state as
      | string
      | undefined;

    const codeVerifier = request.cookies.oauth_login_verifier as
      | string
      | undefined;

    if (
      !code ||
      !returnedState ||
      !expectedState ||
      !codeVerifier ||
      returnedState !== expectedState
    ) {
      response.status(400).json({
        error: "Callback OAuth inválido",
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
        resource: appOrigin,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("Error del token endpoint:", errorBody);

      response.status(502).json({
        error: "No fue posible completar el intercambio OAuth",
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
        error: "El servidor OAuth no entregó un access token",
      });
      return;
    }

    const { payload } = await jwtVerify(tokenData.access_token, jwks, {
      issuer: issuerUrl,
      audience: appOrigin,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      response.status(502).json({
        error: "El token no contiene la identidad esperada",
      });
      return;
    }

    const now = new Date().toISOString();

    const { data: user, error: userError } = await supabase
      .from("users")
     .upsert(
            {
                external_subject: payload.sub,
                email: payload.email,
                student_id:
                typeof payload.student_id === "string"
                ? payload.student_id
                : typeof payload.student_id === "number"
                ? String(payload.student_id)
                : null,
                updated_at: now,
            },
            {
                onConflict: "external_subject",
            },
)
      .select("id, email")
      .single();

    if (userError || !user) {
      console.error("Error guardando usuario:", userError);

      response.status(500).json({
        error: "No fue posible guardar el usuario",
      });
      return;
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const sessionExpiration = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();

    const oauthExpiration = new Date(
      Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    ).toISOString();

    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        token_hash: hashValue(sessionToken),
        expires_at: sessionExpiration,
        login_access_token_encrypted: encryptText(
          tokenData.access_token,
        ),
        login_refresh_token_encrypted: tokenData.refresh_token
          ? encryptText(tokenData.refresh_token)
          : null,
        oauth_token_expires_at: oauthExpiration,
      });

    if (sessionError) {
      console.error("Error creando sesión:", sessionError);

      response.status(500).json({
        error: "No fue posible crear la sesión",
      });
      return;
    }

    response.clearCookie("oauth_login_state", temporaryCookieOptions);
    response.clearCookie(
      "oauth_login_verifier",
      temporaryCookieOptions,
    );

    response.cookie(
      sessionCookieName,
      sessionToken,
      sessionCookieOptions,
    );

    response.redirect(`${appOrigin}/dashboard`);
  } catch (error) {
    console.error("Error completando OAuth:", error);

    response.status(500).json({
      error: "Error interno durante la autenticación",
    });
  }
});


router.get("/me", async (request, response) => {
  try {
    const sessionToken = request.cookies[sessionCookieName] as
      | string
      | undefined;

    if (!sessionToken) {
      response.status(401).json({
        authenticated: false,
      });
      return;
    }

    const tokenHash = hashValue(sessionToken);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (sessionError) {
      console.error("Error consultando sesión:", sessionError);

      response.status(500).json({
        error: "No fue posible consultar la sesión",
      });
      return;
    }

    if (!session || new Date(session.expires_at) <= new Date()) {
      if (session) {
        await supabase
          .from("sessions")
          .delete()
          .eq("id", session.id);
      }

      response.clearCookie(
        sessionCookieName,
        sessionCookieClearOptions,
      );

      response.status(401).json({
        authenticated: false,
      });
      return;
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, student_id")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      console.error("Error consultando usuario:", userError);

      response.status(500).json({
        error: "No fue posible consultar el usuario",
      });
      return;
    }

    response.status(200).json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("Error verificando sesión:", error);

    response.status(500).json({
      error: "Error interno verificando la sesión",
    });
  }
});

router.post("/logout", async (request, response) => {
  try {
    const sessionToken = request.cookies[sessionCookieName] as
      | string
      | undefined;

    if (sessionToken) {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("token_hash", hashValue(sessionToken));

      if (error) {
        console.error("Error eliminando sesión:", error);
      }
    }

    response.clearCookie(
      sessionCookieName,
      sessionCookieClearOptions,
    );

    response.sendStatus(204);
  } catch (error) {
    console.error("Error cerrando sesión:", error);

    response.status(500).json({
      error: "No fue posible cerrar la sesión",
    });
  }
});
export default router;