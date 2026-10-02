import { type FormEvent, useMemo, useState } from "react";

interface SchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
  };
}

interface ToolExecutorProps {
  connectionId: string;
  tool: McpTool;
}

type FormValues = Record<string, string | boolean>;

function convertValue(
  value: string | boolean,
  property: SchemaProperty,
): unknown {
  if (property.type === "number" || property.type === "integer") {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      throw new Error("Debes ingresar un número válido");
    }

    return property.type === "integer"
      ? Math.trunc(numberValue)
      : numberValue;
  }

  if (property.type === "boolean") {
    return Boolean(value);
  }

  if (property.type === "array" || property.type === "object") {
    if (typeof value !== "string") {
      return value;
    }

    return JSON.parse(value);
  }

  return String(value);
}

function ToolExecutor({
  connectionId,
  tool,
}: ToolExecutorProps) {
  const [values, setValues] = useState<FormValues>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const properties = useMemo(
    () => tool.inputSchema.properties ?? {},
    [tool.inputSchema.properties],
  );

  const requiredFields = tool.inputSchema.required ?? [];

  const handleTextChange = (
    fieldName: string,
    value: string,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleBooleanChange = (
    fieldName: string,
    value: boolean,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const argumentsObject: Record<string, unknown> = {};

      for (const [fieldName, property] of Object.entries(
        properties,
      )) {
        const value = values[fieldName];
        const isRequired = requiredFields.includes(fieldName);

        if (
          isRequired &&
          (value === undefined || value === "")
        ) {
          throw new Error(
            `El campo "${property.title ?? fieldName}" es obligatorio`,
          );
        }

        if (value === undefined || value === "") {
          continue;
        }

        argumentsObject[fieldName] = convertValue(
          value,
          property,
        );
      }

      const response = await fetch(
        `/api/mcp/connections/${connectionId}/tools/${encodeURIComponent(tool.name)}/call`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            arguments: argumentsObject,
          }),
        },
      );

      const data = (await response.json()) as {
        result?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "No fue posible ejecutar la tool",
        );
      }

      setResult(data.result);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No fue posible ejecutar la tool",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="toolCard">
      <h3>{tool.title ?? tool.name}</h3>
      <p>{tool.description ?? "Sin descripción"}</p>

      <details>
        <summary>Ver inputSchema</summary>
        <pre>
          {JSON.stringify(tool.inputSchema, null, 2)}
        </pre>
      </details>

      <form className="toolForm" onSubmit={handleSubmit}>
        {Object.entries(properties).map(
          ([fieldName, property]) => {
            const label = property.title ?? fieldName;
            const required =
              requiredFields.includes(fieldName);

            if (property.enum) {
              return (
                <label key={fieldName}>
                  {label}
                  {required && " *"}

                  <select
                    required={required}
                    value={String(values[fieldName] ?? "")}
                    onChange={(event) =>
                      handleTextChange(
                        fieldName,
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Seleccionar</option>

                    {property.enum.map((option) => (
                      <option
                        key={String(option)}
                        value={String(option)}
                      >
                        {String(option)}
                      </option>
                    ))}
                  </select>

                  {property.description && (
                    <small>{property.description}</small>
                  )}
                </label>
              );
            }

            if (property.type === "boolean") {
              return (
                <label
                  className="checkboxField"
                  key={fieldName}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(values[fieldName])}
                    onChange={(event) =>
                      handleBooleanChange(
                        fieldName,
                        event.target.checked,
                      )
                    }
                  />

                  <span>
                    {label}
                    {required && " *"}
                  </span>
                </label>
              );
            }

            if (
              property.type === "array" ||
              property.type === "object"
            ) {
              return (
                <label key={fieldName}>
                  {label}
                  {required && " *"}

                  <textarea
                    required={required}
                    placeholder={
                      property.type === "array"
                        ? 'Ejemplo: ["valor 1", "valor 2"]'
                        : 'Ejemplo: {"campo": "valor"}'
                    }
                    value={String(values[fieldName] ?? "")}
                    onChange={(event) =>
                      handleTextChange(
                        fieldName,
                        event.target.value,
                      )
                    }
                  />

                  {property.description && (
                    <small>{property.description}</small>
                  )}
                </label>
              );
            }

            return (
              <label key={fieldName}>
                {label}
                {required && " *"}

                <input
                  required={required}
                  type={
                    property.type === "number" ||
                    property.type === "integer"
                      ? "number"
                      : property.format === "date"
                        ? "date"
                        : "text"
                  }
                  value={String(values[fieldName] ?? "")}
                  onChange={(event) =>
                    handleTextChange(
                      fieldName,
                      event.target.value,
                    )
                  }
                />

                {property.description && (
                  <small>{property.description}</small>
                )}
              </label>
            );
          },
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Ejecutando..." : "Ejecutar tool"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result !== null && (
        <section className="toolResult">
          <h4>Resultado</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </article>
  );
}

export default ToolExecutor;