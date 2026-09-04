import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

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

app.listen(port, () => {
  console.log(`Backend disponible en http://localhost:${port}`);
});