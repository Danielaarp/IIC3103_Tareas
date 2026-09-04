import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  email: string;
  student_id: string | null;
}

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (response.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error("No fue posible recuperar la sesión");
        }

        const data = (await response.json()) as {
          authenticated: boolean;
          user: User;
        };

        setUser(data.user);
      } catch {
        setError("No fue posible cargar tu sesión.");
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, [navigate]);

    const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", {method: "POST",credentials: "include",});

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

  if (error) {
    return (
      <main className="page centered">
        <section className="card">
          <p className="error">{error}</p>
        </section>
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
      </header>

      <section className="card">
        <h2>Usuario</h2>
        <p>{user?.email}</p>
        {user?.student_id && (
          <p>Número de alumno: {user.student_id}</p>
        )}
      </section>

      <section className="card">
        <h2>Servidores MCP</h2>
        <p>Todavía no tienes servidores MCP conectados.</p>
      </section>
    </main>
  );
}

export default DashboardPage;