import { useState } from "react";
import type { KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
}

export default function ChatInput({
  onSend,
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;

    onSend(input);
    setInput("");
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        value={input}
        onChange={(event) =>
          setInput(event.target.value)
        }
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje..."
        rows={1}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !input.trim()}
      >
        Enviar
      </button>
    </div>
  );
}