import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";

function HomeContent() {
  const { logout } = useAuth();

  return (
    <div style={{ padding: 20 }}>
      <h2>Home</h2>
      <nav>
        <Link to="/profile">Profile</Link> |{" "}
        <Link to="/lobby">Lobby</Link>
      </nav>
      <div style={{ marginTop: 10 }}>
        <button onClick={() => logout()}>Logout</button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}