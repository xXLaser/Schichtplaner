/** Sichere API-Aufrufe mit klaren Fehlermeldungen (wichtig auf dem Server). */

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiGet<T = unknown>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ApiError(
      `Keine Verbindung zu ${url}. Läuft der Server? Firewall/Port 3000 offen?`,
      0,
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      `Serverantwort ist kein JSON (Status ${res.status}). Oft ein Datenbank- oder Serverfehler.`,
      res.status,
      text.slice(0, 200),
    );
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Anfrage fehlgeschlagen (Status ${res.status})`;
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}

export async function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Keine Verbindung zu ${url}.`, 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      `Serverantwort ist kein JSON (Status ${res.status}).`,
      res.status,
      text.slice(0, 200),
    );
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Anfrage fehlgeschlagen (Status ${res.status})`;
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}
