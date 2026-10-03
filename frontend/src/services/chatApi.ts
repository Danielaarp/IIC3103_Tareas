export async function getChats() {
  const response = await fetch("/api/chats", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  return response.json();
}

export async function createChat() {
  const response = await fetch("/api/chats", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  return response.json();
}

export async function getChatMessages(
  chatId: string,
) {
  const response = await fetch(
    `/api/chats/${chatId}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  return response.json();
}

export async function sendMessage(
  chatId: string,
  text: string,
) {
  const response = await fetch(
    `/api/chats/${chatId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ text }),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ?? `Error HTTP ${response.status}`,
    );
  }

  return data;
}