import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import Login from "./routes/login";
import Register from "./routes/register";
import Home from "./routes/home";
import Profile from "./routes/profile";
import Lobby from "./routes/lobby";
import GamePage from "./routes/gamepage";

import { AuthProvider, useAuth } from "./context/AuthContext";

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/home"
            element={
              <Protected>
                <Home />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route
            path="/lobby"
            element={
              <Protected>
                <Lobby />
              </Protected>
            }
          />
          <Route
            path="/game/:id"
            element={
              <Protected>
                <GamePage />
              </Protected>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}