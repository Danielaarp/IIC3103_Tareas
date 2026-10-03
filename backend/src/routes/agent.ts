import { Router } from "express";
import { getAuthenticatedSession } from "../auth/session.js";
import { buildToolCatalog } from "../agent/catalog.js";
import * as grpc from "@grpc/grpc-js";
import { runAgent } from "../agent/runAgent.js";

const router = Router();


router.get("/catalog", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión",
      });
      return;
    }

    const catalog = await buildToolCatalog(session.userId);

    response.json({
      tools: catalog.tools.map((tool) => {
        const target = catalog.targets.get(tool.name);

        return {
          name: tool.name,
          originalName: target?.originalName,
          serverName: target?.serverName,
          description: tool.description,
          inputSchema: JSON.parse(tool.input_schema_json),
        };
      }),
      warnings: catalog.warnings,
    });
  } catch (error) {
    console.error("Error construyendo catálogo:", error);

    response.status(500).json({
      error: "No fue posible construir el catálogo",
    });
  }
});
router.post("/test", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión",
      });
      return;
    }

    const text: unknown = request.body?.text;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 12_000
    ) {
      response.status(400).json({
        error: "Envía un texto de 1 a 12000 caracteres",
      });
      return;
    }

    const result = await runAgent(
      session.userId,
      [], // Historial vacío para esta prueba.
      text.trim(),
    );

    response.json(result);
  } catch (error) {
    const isRateLimit =
      error instanceof Error &&
      "code" in error &&
      error.code === grpc.status.RESOURCE_EXHAUSTED;

    console.error(
      "Error ejecutando agente:",
      error instanceof Error ? error.message : "Error desconocido",
    );

    response.status(isRateLimit ? 429 : 502).json({
      error: isRateLimit
        ? "Límite de llamadas alcanzado. Espera un minuto " +
          "y vuelve a enviar el mensaje."
        : "No fue posible completar la consulta del agente.",
    });
  }
});
export default router;