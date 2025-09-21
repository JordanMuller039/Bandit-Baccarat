import React from "react";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";

function ProfileContent() {
  const { token } = useAuth();
  return (
    <div style={{ padding: 20 }}>
      <h2>Profile</h2>
      <div>Token: {token ? token.slice(0, 24) + "..." : "Not logged in"}</div>
    </div>
  );
}

export default function Profile() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}