import ReactMarkdown from "react-markdown";
import ToolTrace from "./ToolTrace";
import useAutoScroll from "../../hooks/useAutoScroll";
import type { ChatMessage } from "../../types/chat";

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export default function ChatMessages({
  messages,
}: ChatMessagesProps) {
  const bottomRef = useAutoScroll(messages);

  return (
    <div className="chat-messages">
      {messages.map((message) => {
        const role = message.role;

        if (role === "TOOL") {
          return (
            <ToolTrace
              key={message.id}
              message={message}
            />
          );
        }

        if (
          role === "MODEL" &&
          message.function_calls?.length
        ) {
          return (
            <div key={message.id}>
              {message.text && (
                <div className="message model-message">
                  <ReactMarkdown>
                    {message.text}
                  </ReactMarkdown>
                </div>
              )}

              <ToolTrace message={message} />
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`message ${
              role === "USER"
                ? "user-message"
                : "model-message"
            }`}
          >
            <ReactMarkdown>
              {message.text ?? ""}
            </ReactMarkdown>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}