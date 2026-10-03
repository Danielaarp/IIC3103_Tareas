import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ToolExecutor, {
  type McpTool,
} from "../components/chat/ToolExecutor";

interface User {
  id: string;
  email: string;
  student_id: string | null;
}

interface McpConnection {
  id: string;
  name: string;
  server_url: string;
  auth_method: string;
  token_expires_at: string | null;
  created_at: string;
}

function DashboardPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingToolsId, setLoadingToolsId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [authResponse, connectionsResponse] =
          await Promise.all([
            fetch("/api/auth/me", {
              credentials: "include",
            }),
            fetch("/api/mcp/connections", {
              credentials: "include",
            }),
          ]);

        if (
          authResponse.status === 401 ||
          connectionsResponse.status === 401
        ) {
          navigate("/", { replace: true });
          return;
        }

        if (!authResponse.ok || !connectionsResponse.ok) {
          throw new Error("No fue posible cargar el dashboard");
        }

        const authData = (await authResponse.json()) as {
          authenticated: boolean;
          user: User;
        };

        const connectionsData =
          (await connectionsResponse.json()) as {
            connections: McpConnection[];
          };

        setUser(authData.user);
        setConnections(connectionsData.connections);
      } catch {
        setError("No fue posible cargar la información.");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [navigate]);

  const handleConnect = (method: string) => {
    window.location.assign(
      `/api/mcp/${method.toLowerCase()}/connect`,
    );
  };

  const handleListTools = async (connectionId: string) => {
    try {
      setError("");
      setLoadingToolsId(connectionId);

      const response = await fetch(
        `/api/mcp/connections/${connectionId}/tools`,
        {
          credentials: "include",
        },
      );

      const data = (await response.json()) as {
        tools?: McpTool[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "No fue posible listar las tools",
        );
      }

      setTools((currentTools) => ({
        ...currentTools,
        [connectionId]: data.tools ?? [],
      }));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No fue posible listar las tools.",
      );
    } finally {
      setLoadingToolsId(null);
    }
  };

  const handleChats = () => {
    navigate("/chat");
  };

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      navigate("/", { replace: true });
      return;
    }

    setError("No fue posible cerrar la sesión.");
  };

  if (loading) {
    return (
      <main className="page centered">
        <p>Cargando sesión...</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="dashboardHeader">
        <div>
          <p className="eyebrow">IntegraTrip</p>
          <h1>Mis conexiones</h1>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>

        <button
          type="button"
          className="secondary"
          onClick={handleChats}
        >
          Ir a mis conversaciones
        </button>
      </header>

      {error && (
        <section className="card">
          <p className="error">{error}</p>
        </section>
      )}

      <section className="card">
        <h2>Usuario</h2>
        <p>{user?.email}</p>

        {user?.student_id && (
          <p>Número de alumno: {user.student_id}</p>
        )}
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Servidores MCP</h2>
            <p>
              Conecta y consulta las herramientas disponibles.
            </p>
          </div>

          <div className="connectionActions">
            {[
              { name: "Andes Air", method: "PRE" },
              { name: "StayWell", method: "DCR" },
              { name: "Cielo Sur", method: "CIMD" },
            ].map((service) => {
              const connected = connections.some(
                (connection) =>
                  connection.auth_method === service.method,
              );

              return (
                <button
                  key={service.method}
                  type="button"
                  className={
                    connected ? "secondary" : undefined
                  }
                  onClick={() =>
                    handleConnect(service.method)
                  }
                >
                  {connected ? "Reconectar" : "Conectar"}{" "}
                  {service.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {connections.length === 0 && (
        <section className="card">
          <p>
            Todavía no tienes servidores MCP conectados.
          </p>
        </section>
      )}

      {connections.map((connection) => (
        <section
          className="card"
          key={connection.id}
        >
          <div className="sectionHeader">
            <div>
              <h2>{connection.name}</h2>

              <p>
                Autenticación:{" "}
                <strong>
                  {connection.auth_method}
                </strong>
              </p>

              <p>
                Estado:{" "}
                {connection.token_expires_at
                  ? new Date(
                      connection.token_expires_at,
                    ).getTime() <= now
                    ? "Token vencido: reconecta el servicio"
                    : "Token vigente"
                  : "Sin fecha de vencimiento informada"}
              </p>
            </div>

            <button
              type="button"
              disabled={
                loadingToolsId === connection.id
              }
              onClick={() =>
                void handleListTools(connection.id)
              }
            >
              {loadingToolsId === connection.id
                ? "Cargando..."
                : "Listar tools"}
            </button>
          </div>

          {tools[connection.id] && (
            <div className="toolsList">
              {tools[connection.id].length === 0 ? (
                <p>
                  Este servidor no informó tools.
                </p>
              ) : (
                tools[connection.id].map((tool) => (
                  <ToolExecutor
                    key={tool.name}
                    connectionId={connection.id}
                    tool={tool}
                  />
                ))
              )}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}

export default DashboardPage;