import { supabase } from "../database/supabase.js";
import { decryptText } from "../security/encryption.js";
import { callMcpTool } from "../mcp/client.js";
import type {
  FunctionCall,
  FunctionResult,
} from "../llm/client.js";
import type { ToolCatalog } from "./catalog.js";



export async function executeTool(
  userId: string,
  call: FunctionCall,
  catalog: ToolCatalog,
): Promise<FunctionResult> {
  try {
    const target = catalog.targets.get(call.name);

    if (!target) {
      throw new Error("Herramienta desconocida");
    }

  
    const argumentsObject: unknown = JSON.parse(
      call.arguments_json,
    );

    if (
      argumentsObject === null ||
      typeof argumentsObject !== "object" ||
      Array.isArray(argumentsObject)
    ) {
      throw new Error(
        "Los argumentos deben ser un objeto JSON",
      );
    }

    const { data: connection, error } = await supabase
      .from("mcp_connections")
      .select(
        "id, server_url, access_token_encrypted, token_expires_at",
      )
      .eq("id", target.connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !connection) {
      throw new Error("Conexión no disponible");
    }

    if (!connection.access_token_encrypted) {
      throw new Error("La conexión no tiene access token");
    }

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at).getTime() <=
        Date.now()
    ) {
      throw new Error(
        `El token de ${target.serverName} venció. ` +
        "Reconecta el servicio.",
      );
    }

    const accessToken = decryptText(
      connection.access_token_encrypted,
    );

    const result = await callMcpTool(
      connection.server_url,
      accessToken,
      target.originalName,
      argumentsObject as Record<string, unknown>,
    );

    return {
      name: call.name,
      id: call.id,
      result_json: JSON.stringify(result),
      is_error: Boolean(result.isError),
    };
  } catch (error) {
    return {
      name: call.name,
      id: call.id,
      result_json: JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Error ejecutando herramienta",
      }),
      is_error: true,
    };
  }
}