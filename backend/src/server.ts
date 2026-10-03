import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { supabase } from "./database/supabase.js";
import authRouter from "./routes/auth.js";
import mcpPreRouter from "./routes/mcpPre.js";
import mcpConnectionsRouter from "./routes/mcpConnections.js";
import mcpDcrRouter from "./routes/mcpDcr.js";
import mcpCimdRouter from "./routes/mcpCimd.js";
import agentRouter from "./routes/agent.js";
import chatsRouter from "./routes/chats.js";
const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api/mcp/pre", mcpPreRouter);
app.use("/api/mcp/connections", mcpConnectionsRouter);
app.use("/api/mcp/dcr", mcpDcrRouter);
app.use("/api/mcp/cimd", mcpCimdRouter);
app.use("/api/agent", agentRouter);
app.use("/api/chats", chatsRouter);

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