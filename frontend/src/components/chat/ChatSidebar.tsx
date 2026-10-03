import type { Chat } from "../../types/chat";

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onBackToHome: () => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onBackToHome,
}: ChatSidebarProps) {
  return (
    <aside className="chat-sidebar">
      <button
        type="button"
        className="new-chat-button"
        onClick={onNewChat}
      >
        + Nuevo chat
      </button>

      <button
        type="button"
        className="back-home-button"
        onClick={onBackToHome}
      >
        ← Volver a inicio
      </button>

      <div className="chat-list">
        {chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => onSelectChat(chat.id)}
            className={
              chat.id === activeChatId
                ? "chat-item active"
                : "chat-item"
            }
          >
            {chat.title}
          </button>
        ))}
      </div>
    </aside>
  );
}