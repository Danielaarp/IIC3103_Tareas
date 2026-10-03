import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatSidebar from "../components/chat/ChatSidebar";
import Chatbot from "../components/chat/Chatbot";
import { getChats, createChat } from "../services/chatApi";
import type { Chat } from "../types/chat";

export default function ChatPage() {
  const navigate = useNavigate();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] =
    useState<string | null>(null);
  const [newChatLoading, setNewChatLoading] =
    useState(false);

  const handleNewChat = async () => {
    if (newChatLoading) return;

    setNewChatLoading(true);

    try {
      const data = await createChat();
      const newChat = data.chat ?? data;

      setChats((prevChats) => [
        newChat,
        ...prevChats,
      ]);

      setActiveChatId(newChat.id);
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      setNewChatLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate("/dashboard");
  };

  useEffect(() => {
    async function loadChats() {
      try {
        const data = await getChats();
        setChats(data.chats);
      } catch (error) {
        console.error("Error cargando chats:", error);
      }
    }

    void loadChats();
  }, []);

  return (
    <main className="chat-page">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={handleNewChat}
        onBackToHome={handleBackToHome}
      />

      <Chatbot chatId={activeChatId} />
    </main>
  );
}