import { Router } from "express";
import { getAuthenticatedSession } from "../auth/session.js";
import { supabase } from "../database/supabase.js";

import * as grpc from "@grpc/grpc-js";
import { runAgent } from "../agent/runAgent.js";
import type { LlmMessage } from "../llm/client.js";
const router = Router();

router.use(async (request, response, next) => {
  try {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      response.status(401).json({
        error: "Debes iniciar sesión",
      });
      return;
    }

    response.locals.userId = session.userId;
    next();
  } catch (error) {
    next(error);
  }
});

// Listar las conversaciones del usuario.
router.get("/", async (_request, response) => {
  const { data, error } = await supabase
    .from("chats")
    .select("id, title, created_at, updated_at")
    .eq("user_id", response.locals.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error listando chats:", error);
    response.status(500).json({
      error: "No fue posible listar las conversaciones",
    });
    return;
  }

  response.json({ chats: data ?? [] });
});

// Crear una conversación vacía.
router.post("/", async (_request, response) => {
  const { data, error } = await supabase
    .from("chats")
    .insert({
      user_id: response.locals.userId,
      title: "Nueva conversación",
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error creando chat:", error);
    response.status(500).json({
      error: "No fue posible crear la conversación",
    });
    return;
  }

  response.status(201).json({ chat: data });
});

// Abrir una conversación y recuperar sus mensajes.
router.get("/:chatId", async (request, response) => {
  const { chatId } = request.params;

  // Primero comprueba que el chat pertenece al usuario.
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, title, created_at, updated_at")
    .eq("id", chatId)
    .eq("user_id", response.locals.userId)
    .maybeSingle();

  if (chatError) {
    console.error("Error consultando chat:", chatError);
    response.status(500).json({
      error: "No fue posible consultar la conversación",
    });
    return;
  }

  if (!chat) {
    response.status(404).json({
      error: "Conversación no encontrada",
    });
    return;
  }

  // Recupera todo el historial por bloques para evitar
  // el límite de filas que puede aplicar Supabase.
  const messages = [];

  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, payload, created_at")
      .eq("chat_id", chatId)
      .order("id", { ascending: true })
      .range(offset, offset + 499);

    if (error) {
      console.error("Error recuperando mensajes:", error);
      response.status(500).json({
        error: "No fue posible recuperar los mensajes",
      });
      return;
    }

    messages.push(...(data ?? []));

    if (!data || data.length < 500) {
      break;
    }
  }

  response.json({ chat, messages });
});

//revisar 
const processingChats = new Set<string>();

router.post("/:chatId/messages", async (request, response) => {
  const { chatId } = request.params;
  const userId: string = response.locals.userId;
  const text: unknown = request.body?.text;

  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 12_000
  ) {
    response.status(400).json({
      error: "Envía un mensaje de 1 a 12000 caracteres",
    });
    return;
  }

  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, title")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (chatError) {
    response.status(500).json({
      error: "No fue posible consultar la conversación",
    });
    return;
  }

  if (!chat) {
    response.status(404).json({
      error: "Conversación no encontrada",
    });
    return;
  }

  if (processingChats.has(chatId)) {
    response.status(409).json({
      error: "Este chat está procesando otro mensaje",
    });
    return;
  }

  processingChats.add(chatId);

  try {
    const history: LlmMessage[] = [];

    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("payload")
        .eq("chat_id", chatId)
        .order("id", { ascending: true })
        .range(offset, offset + 499);

      if (error) {
        throw new Error("No fue posible recuperar el historial");
      }

      history.push(
        ...(data ?? []).map(
          (row) => row.payload as LlmMessage,
        ),
      );

      if (!data || data.length < 500) {
        break;
      }
    }

    const saveMessage = async (
      message: LlmMessage,
    ): Promise<void> => {
      const { error } = await supabase
        .from("chat_messages")
        .insert({
          chat_id: chatId,
          payload: message,
        });

      if (error) {
        throw new Error("No fue posible guardar el mensaje");
      }
    };

    const result = await runAgent(
      userId,
      history,
      text.trim(),
      saveMessage,
    );

    const { error: updateError } = await supabase
      .from("chats")
      .update({
        updated_at: new Date().toISOString(),
        ...(chat.title === "Nueva conversación"
          ? { title: text.trim().slice(0, 70) }
          : {}),
      })
      .eq("id", chatId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error("No fue posible actualizar el chawt");
    }

    response.json(result);
  } catch (error) {
    const isRateLimit =
      error instanceof Error &&
      "code" in error &&
      error.code === grpc.status.RESOURCE_EXHAUSTED;

    console.error(
      "Error procesando chat:",
      error instanceof Error ? error.message : "Error desconocido",
    );

    response.status(isRateLimit ? 429 : 502).json({
      error: isRateLimit
        ? "Límite de llamadas alcanzado. Espera un minuto " +
          "y vuelve a enviar un mensaje."
        : "No fue posible completar el mensaje. " +
          "Los mensajes ya guardados se conservan.",
    });
  } finally {
    processingChats.delete(chatId);
  }
});
export default router;