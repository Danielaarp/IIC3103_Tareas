import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

async function withMcpClient<T>(
  serverUrl: string,
  accessToken: string,
  operation: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    name: "integratrip",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(
    new URL(serverUrl),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );

  try {
    await client.connect(transport);
    return await operation(client);
  } finally {
    try {
      await transport.terminateSession();
    } catch {
      // El servidor puede ser stateless.
    }

    await client.close();
  }
}

export async function listMcpTools(
  serverUrl: string,
  accessToken: string,
) {
  return withMcpClient(
    serverUrl,
    accessToken,
    async (client) => {
      const result = await client.listTools();
      return result.tools;
    },
  );
}

export async function callMcpTool(
  serverUrl: string,
  accessToken: string,
  toolName: string,
  argumentsObject: Record<string, unknown>,
) {
  return withMcpClient(
    serverUrl,
    accessToken,
    async (client) =>
      client.callTool({
        name: toolName,
        arguments: argumentsObject,
      }),
  );
}