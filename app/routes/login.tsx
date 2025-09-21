import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

console.log("LOGIN CONSOLE TEST")
export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { saveToken } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/auth/login`, { username, password });
      saveToken(res.data.token);
      nav("/home");
    } catch (err: any) {
      alert(err?.response?.data?.error || "Login failed");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <form onSubmit={submit}>
        <input placeholder="username" value={username} onChange={e => setUsername(e.target.value)} /><br/>
        <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} /><br/>
        <button type="submit">Login</button>
      </form>
      <div style={{ marginTop: 10 }}>
        <Link to="/register">Create an account</Link>
      </div>
    </div>
  );
}
