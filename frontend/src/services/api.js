const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiRequest(path, options = {}) {
  return request(path, options, localStorage.getItem("fis_token"));
}

export async function customerApiRequest(path, options = {}) {
  return request(path, options, localStorage.getItem("customer_token"));
}

async function request(path, options, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The server request failed");
  return body;
}
