import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/western-theme.css";

export default function Home() {
  const { logout } = useAuth();

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="western-container">
        <h1 className="western-title">Saloon Main Hall</h1>
        <p className="western-subtitle">Welcome back, partner</p>
        
        <div className="western-card">
          <h3 style={{ color: "var(--dark-wood)", marginBottom: "20px", textAlign: "center" }}>
            Choose Your Adventure
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <Link to="/lobby" style={{ textDecoration: "none" }}>
              <button className="western-btn" style={{ width: "100%" }}>
                Join a Card Game
              </button>
            </Link>
            
            <Link to="/profile" style={{ textDecoration: "none" }}>
              <button className="western-btn" style={{ width: "100%" }}>
                Check Your Rep
              </button>
            </Link>
          </div>
        </div>
        
        <div style={{ textAlign: "center", marginTop: "30px" }}>
          <button 
            onClick={() => logout()}
            className="western-btn"
            style={{ 
              background: "var(--gunmetal)",
              borderColor: "var(--shadow-black)"
            }}
          >
            Leave Town
          </button>
        </div>
      </div>
    </div>
  );
}