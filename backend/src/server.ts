import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { supabase } from "./database/supabase.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "integratrip-backend",
  });
});

app.get("/api/health/database", async (_request, response) => {
  const { error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("Error al conectar con Supabase:", error.message);

    response.status(503).json({
      status: "error",
      database: "unavailable",
    });

    return;
  }

  response.status(200).json({
    status: "ok",
    database: "connected",
  });
});

app.listen(port, () => {
  console.log(`Backend disponible en http://localhost:${port}`);
});