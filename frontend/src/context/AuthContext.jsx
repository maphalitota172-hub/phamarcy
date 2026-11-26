import { createContext, useContext, useState } from "react";
import { apiRequest } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fis_user"));
    } catch {
      return null;
    }
  });

  async function login(username, password) {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem("fis_token", result.token);
    localStorage.setItem("fis_user", JSON.stringify(result.user));
    setUser(result.user);
  }

  function logout() {
    localStorage.removeItem("fis_token");
    localStorage.removeItem("fis_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
