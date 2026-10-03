import type { ChatMessage } from "../../types/chat";

interface ToolTraceProps {
  message: ChatMessage;
}

function formatJson(value: string): string {
  try {
    return JSON.stringify(
      JSON.parse(value),
      null,
      2,
    );
  } catch {
    return value;
  }
}

export default function ToolTrace({
  message,
}: ToolTraceProps) {
  if (
    message.role === "MODEL" &&
    message.function_calls?.length
  ) {
    return (
      <div className="tool-trace">
        {message.function_calls.map((call, index) => (
          <div
            key={`${call.name}-${index}`}
            className="tool-trace-block"
          >
            <div className="tool-trace-title">
              🔧 {call.name}
            </div>

            <div className="tool-trace-label">
              Argumentos
            </div>

            <pre>
              {formatJson(call.arguments_json)}
            </pre>
          </div>
        ))}
      </div>
    );
  }

  if (
    message.role === "TOOL" &&
    message.function_results?.length
  ) {
    return (
      <div className="tool-trace">
        {message.function_results.map(
          (result, index) => (
            <div
              key={`${result.name}-${index}`}
              className={`tool-trace-block ${
                result.is_error
                  ? "tool-error"
                  : "tool-success"
              }`}
            >
              <div className="tool-trace-title">
                {result.is_error ? "❌" : "✅"}{" "}
                {result.name}
              </div>

              <div className="tool-trace-label">
                {result.is_error
                  ? "Error"
                  : "Resultado"}
              </div>

              <pre>
                {formatJson(result.result_json)}
              </pre>
            </div>
          ),
        )}
      </div>
    );
  }

  return null;
}