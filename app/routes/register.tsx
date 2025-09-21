import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isClient, setIsClient] = useState(false);
  const { saveToken } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    setIsClient(true);
    console.log("Component mounted on client!");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    if (!isClient) return;
    
    e.preventDefault();
    e.stopPropagation();
    console.log("Form submitted on client!");
    
    try {
      const response = await axios.post("http://localhost:3001/api/auth/register", {
        username,
        password
      });
      console.log("Registration successful:", response.data);
      saveToken(response.data.token);
      nav("/home");
    } catch (error: any) {
      console.error("Registration error:", error);
      alert(error?.response?.data?.error || "Registration failed");
    }
  }

  if (!isClient) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input 
          placeholder="username" 
          value={username} 
          onChange={e => setUsername(e.target.value)}
          required
        /><br/>
        <input 
          placeholder="password" 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)}
          required
        /><br/>
        <button type="submit">Register</button>
      </form>
    </div>
  );
}