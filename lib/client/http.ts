export async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as { error?: string } & TResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Ошибка запроса.");
  }

  return data;
}
