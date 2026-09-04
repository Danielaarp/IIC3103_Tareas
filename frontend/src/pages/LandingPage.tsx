function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <main className="page centered">
      <section className="card hero">
        <p className="eyebrow">Planificación de viajes</p>
        <h1>IntegraTrip</h1>
        <p>
          Conecta servicios de vuelos, alojamiento y clima desde una
          sola aplicación.
        </p>

        <button type="button" onClick={handleLogin}>
          Iniciar sesión
        </button>
      </section>
    </main>
  );
}

export default LandingPage;