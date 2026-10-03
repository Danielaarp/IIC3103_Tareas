import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";

export interface FunctionCall {
  name: string;
  arguments_json: string;
  id: string;
}

export interface FunctionResult {
  name: string;
  result_json: string;
  id: string;
  is_error: boolean;
}

export interface LlmMessage {
  role: "USER" | "MODEL" | "TOOL";
  text?: string;
  function_calls?: FunctionCall[];
  function_results?: FunctionResult[];
}

export interface LlmTool {
  name: string;
  description: string;
  input_schema_json: string;
}

export interface GenerateResponse {
  text: string;
  function_calls: FunctionCall[];
  stop: boolean;
}

interface GenerateRequest {
  messages: LlmMessage[];
  tools: LlmTool[];
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

let client: LlmClient | undefined;

function getClient(): LlmClient {
  if (client) {
    return client;
  }

  const protoPath = fileURLToPath(
    new URL("./llm.proto", import.meta.url),
  );

  const definition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    enums: String,
    defaults: true,
  });

  const api = grpc.loadPackageDefinition(
    definition,
  ) as unknown as {
    iic3103: {
      llm: {
        v1: {
          Llm: grpc.ServiceClientConstructor;
        };
      };
    };
  };

  const target =
    process.env.LLM_GRPC_TARGET ??
    "dns:///iic3103-tarea2-llm-z2fqxmm2ja-uc.a.run.app:443";

  const credentials =
    process.env.LLM_GRPC_TLS === "false"
      ? grpc.credentials.createInsecure()
      : grpc.credentials.createSsl();

  client = new api.iic3103.llm.v1.Llm(
    target,
    credentials,
  ) as unknown as LlmClient;

  return client;
}

export function generate(
  messages: LlmMessage[],
  tools: LlmTool[] = [],
): Promise<GenerateResponse> {
  const email = process.env.LLM_STUDENT_EMAIL;
  const studentId = process.env.LLM_STUDENT_ID;

  if (!email || !studentId) {
    return Promise.reject(
      new Error("Faltan las credenciales del LLM"),
    );
  }

  const metadata = new grpc.Metadata();

  metadata.set("x-student-email", email);
  metadata.set("x-student-id", studentId);

  return new Promise((resolve, reject) => {
    getClient().Generate(
      { messages, tools },
      metadata,
      { deadline: Date.now() + 60_000 },
      (error, response) => {
        if (error) {
          reject(error);
          return;
        }

        if (!response) {
          reject(new Error("El LLM no entregó respuesta"));
          return;
        }

        resolve(response);
      },
    );
  });
}