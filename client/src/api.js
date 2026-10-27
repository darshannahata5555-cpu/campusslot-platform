export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "The server is unavailable. Please try again." }));
  if (!response.ok) {
    const e = new Error(data.error || "Request failed.");
    e.status = response.status;
    throw e;
  }
  return data;
}
export const post = (path, body = {}) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
