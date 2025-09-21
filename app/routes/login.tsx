import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/western-theme.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { saveToken } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/auth/login`, { 
        username, 
        password 
      });
      saveToken(res.data.token);
      nav("/home");
    } catch (err: any) {
      alert(err?.response?.data?.error || "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="western-container">
        <h1 className="western-title">Bandit Baccarat</h1>
        <p className="western-subtitle">Enter the Saloon</p>
        
        <form onSubmit={submit}>
          <input 
            className="western-input"
            placeholder="Enter your handle, partner..."
            value={username} 
            onChange={e => setUsername(e.target.value)}
            required
          />
          
          <input 
            className="western-input"
            placeholder="Secret word..."
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            required
          />
          
          <button 
            type="submit" 
            className="western-btn"
            disabled={isLoading}
            style={{ width: "100%", marginBottom: "20px" }}
          >
            {isLoading ? "Entering Saloon..." : "Draw & Enter"}
          </button>
        </form>
        
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--aged-paper)", marginBottom: "10px" }}>
            New to these parts?
          </p>
          <Link 
            to="/register"
            style={{ 
              color: "var(--dusty-gold)", 
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "18px"
            }}
          >
            Register Your Name
          </Link>
        </div>
      </div>
    </div>
  );
}