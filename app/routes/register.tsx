import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/western-theme.css";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { saveToken } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/auth/register`, { 
        username, 
        password 
      });
      saveToken(res.data.token);
      nav("/home");
    } catch (err: any) {
      alert(err?.response?.data?.error || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="western-container">
        <h1 className="western-title">Join the Gang</h1>
        <p className="western-subtitle">Stake Your Claim in the Wild West</p>
        
        <form onSubmit={submit}>
          <input 
            className="western-input"
            placeholder="Choose your bandit name..."
            value={username} 
            onChange={e => setUsername(e.target.value)}
            required
          />
          
          <input 
            className="western-input"
            placeholder="Create a secret word..."
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          
          <button 
            type="submit" 
            className="western-btn"
            disabled={isLoading}
            style={{ width: "100%", marginBottom: "20px" }}
          >
            {isLoading ? "Joining Gang..." : "Claim Your Territory"}
          </button>
        </form>
        
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--aged-paper)", marginBottom: "10px" }}>
            Already got a reputation?
          </p>
          <Link 
            to="/"
            style={{ 
              color: "var(--dusty-gold)", 
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "18px"
            }}
          >
            Return to Saloon
          </Link>
        </div>
      </div>
    </div>
  );
}