import { supabase } from "../database/supabase.js";
import { decryptText } from "../security/encryption.js";
import { listMcpTools } from "../mcp/client.js";
import type { LlmTool } from "../llm/client.js";
import { createHash } from "node:crypto";

export interface ToolTarget {
  connectionId: string;
  originalName: string;
  serverName: string;
}

export interface ToolCatalog {
  tools: LlmTool[];
  targets: Map<string, ToolTarget>;
  warnings: string[];
}

export async function buildToolCatalog(
  userId: string,
): Promise<ToolCatalog> {
  const { data: connections, error } = await supabase
    .from("mcp_connections")
    .select("id, name, auth_method, server_url, access_token_encrypted, token_expires_at",)

    .eq("user_id", userId);

  if (error) {
    throw new Error("No fue posible consultar las conexiones");
  }

  const tools: LlmTool[] = [];
  const targets = new Map<string, ToolTarget>();
  const warnings: string[] = [];

  for (const connection of connections ?? []) {
    try {
      if (!connection.access_token_encrypted) {
        throw new Error("No tiene access token");
      }

      if (
        connection.token_expires_at &&
        new Date(connection.token_expires_at).getTime() <=
          Date.now()
      ) {
        throw new Error("Token vencido: reconecta el servicio");
      }

      const accessToken = decryptText(
        connection.access_token_encrypted,
      );

      const serverTools = await listMcpTools(
        connection.server_url,
        accessToken,
      );

      for (const tool of serverTools) {
        // Usa solo caracteres admitidos por el protocolo.
        const prefix = String(connection.auth_method)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_");

        const originalName = tool.name.replace(
          /[^a-zA-Z0-9_]/g,
          "_",
        );

        // El índice hace únicos los nombres del catálogo.
        // El hash identifica la misma conexión y herramienta,
// aunque cambie el orden del catálogo.
const suffix =
  "_" +
  createHash("sha256")
    .update(`${connection.id}:${tool.name}`)
    .digest("hex")
    .slice(0, 12);
        const base = `mcp_${prefix}_${originalName}`;
        const alias =
          base.slice(0, 64 - suffix.length) + suffix;

        tools.push({
          name: alias,
          description:
            `[${connection.name}] ` +
            (tool.description ?? tool.name),
          input_schema_json: JSON.stringify(
            tool.inputSchema,
          ),
        });

        targets.set(alias, {
          connectionId: connection.id,
          originalName: tool.name,
          serverName: connection.name,
        });
      }
    } catch (error) {
      warnings.push(
        `${connection.name}: ${
          error instanceof Error
            ? error.message
            : "No fue posible listar sus herramientas"
        }`,
      );
    }
  }

  return { tools, targets, warnings };
}