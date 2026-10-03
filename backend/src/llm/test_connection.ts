import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";

const email = process.env.LLM_STUDENT_EMAIL;
const studentId = process.env.LLM_STUDENT_ID;

if (!email || !studentId) {
  throw new Error(
    "Faltan LLM_STUDENT_EMAIL o LLM_STUDENT_ID",
  );
}

// Localiza el .proto junto a este archivo.
const protoPath = fileURLToPath(
  new URL("./llm.proto", import.meta.url),
);

const definition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  enums: String,
  defaults: true,
});

const loaded = grpc.loadPackageDefinition(definition);

// Describe la estructura del paquete definido en el proto.
const api = loaded as unknown as {
  iic3103: {
    llm: {
      v1: {
        Llm: grpc.ServiceClientConstructor;
      };
    };
  };
};

interface GenerateRequest {
  messages: {
    role: "USER";
    text: string;
  }[];
  tools: [];
}

interface GenerateResponse {
  text: string;
}

type LlmClient = grpc.Client & {
  Generate(
    request: GenerateRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: (
      error: grpc.ServiceError | null,
      response?: GenerateResponse,
    ) => void,
  ): grpc.ClientUnaryCall;
};

const target =
  process.env.LLM_GRPC_TARGET ??
  "dns:///iic3103-tarea2-llm-z2fqxmm2ja-uc.a.run.app:443";

const credentials =
  process.env.LLM_GRPC_TLS === "false"
    ? grpc.credentials.createInsecure()
    : grpc.credentials.createSsl();

const client = new api.iic3103.llm.v1.Llm(
  target,
  credentials,
) as unknown as LlmClient;
// Metadata equivale a los encabezados de esta llamada gRPC.
const metadata = new grpc.Metadata();

metadata.set("x-student-email", email);
metadata.set("x-student-id", studentId);

client.Generate(
  {
    messages: [
      {
        role: "USER",
        text: "Responde solamente: conexión correcta",
      },
    ],
    tools: [],
  },
  metadata,
  {
    deadline: Date.now() + 60_000,
  },
  (error, response) => {
    if (error) {
      console.error("Error gRPC:", {
        code: error.code,
        status: grpc.status[error.code],
        details: error.details,
      });

      process.exitCode = 1;
    } else {
      console.log("Respuesta:", response?.text);
    }

    client.close();
  },
);