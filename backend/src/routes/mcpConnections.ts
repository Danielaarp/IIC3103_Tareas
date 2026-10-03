import {   Router } from "express";
import { getAuthenticatedSession } from "../auth/session.js";
import { supabase } from "../database/supabase.js";
import { decryptText } from "../security/encryption.js";
import {callMcpTool,listMcpTools,} from "../mcp/client.js";
const router = Router();

router.get("/", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión",
      });
      return;
    }

    const { data: connections, error } = await supabase
      .from("mcp_connections")
      .select(
        "id, name, server_url, auth_method, token_expires_at, created_at",
      )
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error listando conexiones:", error);

      response.status(500).json({
        error: "No fue posible consultar las conexiones",
      });
      return;
    }

    response.status(200).json({
           connections: connections ?? [],
    });
  } catch (error) {
    console.error("Error consultando conexiones:", error);

    response.status(500).json({
      error: "Error interno consultando conexiones",
    });
  }
});



router.get("/:connectionId/tools", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión",
      });
      return;
    }

    const { connectionId } = request.params;

    const { data: connection, error: connectionError } =
      await supabase
        .from("mcp_connections")
        .select(
          "id, name, server_url, access_token_encrypted, token_expires_at",
        )
        .eq("id", connectionId)
        .eq("user_id", session.userId)
        .maybeSingle();

    if (connectionError) {
      console.error(
        "Error consultando conexión:",
        connectionError,
      );

      response.status(500).json({
        error: "No fue posible consultar la conexión",
      });
      return;
    }

    if (!connection) {
      response.status(404).json({
        error: "Conexión MCP no encontrada",
      });
      return;
    }

    if (!connection.access_token_encrypted) {
      response.status(409).json({
        error: "La conexión no tiene un access token",
      });
      return;
    }

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at) <= new Date()
    ) {
      response.status(401).json({
        error:
  `El token de ${connection.name} venció. ` +
  "Usa Reconectar en Configuración.",
        
      });
      return;
    }

    const accessToken = decryptText(
      connection.access_token_encrypted,
    );

    const tools = await listMcpTools(
      connection.server_url,
      accessToken,
    );

    response.status(200).json({
      connection: {
        id: connection.id,
        name: connection.name,
      },
      tools,
    });
  } catch (error) {
    console.error("Error listando tools:", error);

    response.status(502).json({
      error: "No fue posible obtener las tools del servidor MCP",
    });
  }
});


router.post(
  "/:connectionId/tools/:toolName/call",
  async (request, response) => {
    try {
      const session = await getAuthenticatedSession(request);

      if (!session) {
        response.status(401).json({
          error: "Debes iniciar sesión",
        });
        return;
      }

      const { connectionId, toolName } = request.params;
      const argumentsObject = request.body.arguments;

      if (
        typeof argumentsObject !== "object" ||
        argumentsObject === null ||
        Array.isArray(argumentsObject)
      ) {
        response.status(400).json({
          error: "arguments debe ser un objeto",
        });
      }
       const { data: connection, error } = await supabase
        .from("mcp_connections")
        .select(
          "id, server_url, access_token_encrypted, token_expires_at",
        )
        .eq("id", connectionId)
        .eq("user_id", session.userId)
        .maybeSingle();

      if (error) {
        console.error("Error consultando conexión:", error);

        response.status(500).json({
          error: "No fue posible consultar la conexión",
        });
        return;
      }

      if (!connection) {
        response.status(404).json({
          error: "Conexión MCP no encontrada",
        });
        return;
      }

      if (!connection.access_token_encrypted) {
        response.status(409).json({
          error: "La conexión no tiene access token",
        });
        return;
      }

      if (
        connection.token_expires_at &&
        new Date(connection.token_expires_at) <= new Date()
      ) {
        response.status(401).json({
          error: "El token venció. Vuelve a conectar el servidor.",
        });
        return;
      }

      const accessToken = decryptText(
        connection.access_token_encrypted,
      );

      const result = await callMcpTool(
        connection.server_url,
        accessToken,
        toolName,
        argumentsObject as Record<string, unknown>,
      );

      response.status(200).json({
        tool: toolName,
        result,
      });
    } catch (error) {
      console.error("Error ejecutando tool:", error);

      response.status(502).json({
        error: "No fue posible ejecutar la tool",
      });
    }
  },
);

export default router;