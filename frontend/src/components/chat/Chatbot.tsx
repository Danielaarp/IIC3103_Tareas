import { useCallback, useEffect, useState } from "react";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import {
  getChatMessages,
  sendMessage,
} from "../../services/chatApi";
import type { ChatMessage } from "../../types/chat";

interface ChatbotProps {
  chatId: string | null;
}

interface MessageRow {
  id: string;
  payload: Omit<ChatMessage, "id">;
  created_at?: string;
}

export default function Chatbot({
  chatId,
}: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

 const loadMessages = useCallback(async () => {
  if (!chatId) {
    setMessages([]);
    return;
  }

  setLoadingChat(true);

  try {
    const data = await getChatMessages(chatId);

    const formattedMessages: ChatMessage[] =
      data.messages.map((row: MessageRow) => ({
        id: row.id,
        ...row.payload,
        created_at: row.created_at,
      }));

    setMessages(formattedMessages);
  } catch (error) {
    console.error("Error cargando mensajes:", error);
    setMessages([]);
  } finally {
    setLoadingChat(false);
  }
}, [chatId]);

useEffect(() => {
  if (!chatId) return;

  let cancelled = false;

  void getChatMessages(chatId)
    .then((data) => {
      if (cancelled) return;

      const formattedMessages: ChatMessage[] =
        data.messages.map((row: MessageRow) => ({
          id: row.id,
          ...row.payload,
          created_at: row.created_at,
        }));

      setMessages(formattedMessages);
    })
    .catch((error) => {
      if (cancelled) return;

      console.error("Error cargando mensajes:", error);
      setMessages([]);
    });

  return () => {
    cancelled = true;
  };
}, [chatId]);

  const handleSend = async (text: string) => {
    if (!chatId || sendingMessage) return;

    setSendingMessage(true);

    try {
      await sendMessage(chatId, text);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    } finally {
      await loadMessages();
      setSendingMessage(false);
    }
  };

  if (!chatId) {
    return (
      <section className="chatbot">
        <div className="empty-chat">
          Selecciona un chat o crea uno nuevo.
        </div>
      </section>
    );
  }

  return (
    <section className="chatbot">
      {loadingChat ? (
        <div className="chat-loading">
          Cargando conversación...
        </div>
      ) : (
        <ChatMessages messages={messages} />
      )}

      {sendingMessage && (
        <div className="message model-message">
          Pensando...
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        disabled={sendingMessage || loadingChat}
      />
    </section>
  );
}