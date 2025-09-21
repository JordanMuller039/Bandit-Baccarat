import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface LobbyPlayer {
  id: string;
  username: string;
  joined_at: string;
}

interface Lobby {
  id: string;
  created_by: string;
  max_players: number;
  status: string;
  created_at: string;
  players: LobbyPlayer[];
}

export default function Lobby() {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
  const [availableLobbies, setAvailableLobbies] = useState<Lobby[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const nav = useNavigate();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    console.log("Setting up socket connection to:", import.meta.env.VITE_SERVER_URL);
    const s = io(import.meta.env.VITE_SERVER_URL as string, { auth: { token } });
    setSocket(s);

    s.on("connect", () => {
      console.log("Socket connected successfully!");
      setConnectionStatus("Connected");
      // Get initial lobby list
      s.emit("get_lobby_list", (response: any) => {
        console.log("Initial lobby list:", response);
        if (response && response.ok) {
          setAvailableLobbies(response.lobbies);
        }
      });
    });

    s.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setConnectionStatus("Disconnected");
    });

    s.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnectionStatus("Connection Error: " + error.message);
    });

    s.on("lobby_update", (data: any) => {
      console.log("Lobby update received:", data);
      if (data.lobby) {
        setCurrentLobby(data.lobby);
      }
    });

    s.on("game_started", (data: any) => {
      console.log("Game starting:", data);
      nav(`/game/${data.lobbyId}`);
    });

    s.on("lobby_list_updated", () => {
      console.log("Lobby list updated");
      if (s.connected) {
        s.emit("get_lobby_list", (response: any) => {
          if (response && response.ok) {
            setAvailableLobbies(response.lobbies);
          }
        });
      }
    });

    return () => {
      s.disconnect();
    };
  }, [token, isClient]);

  function createLobby() {
  if (!socket || !socket.connected) {
    alert("Not connected to server. Status: " + connectionStatus);
    return;
  }

  console.log("Testing basic socket emit...");
  
  // First test - simple emit without callback
  socket.emit("test_event", "hello");
  
  // Second test - emit with timeout
  socket.timeout(5000).emit("get_lobby_list", (err: any, response: any) => {
    if (err) {
      console.error("Socket timeout or error:", err);
    } else {
      console.log("Got response:", response);
    }
  });

  console.log("Creating lobby...");
  socket.emit("create_lobby", (response: any) => {
    console.log("Create lobby response:", response);
    if (response && response.ok) {
      setCurrentLobby(response.lobby);
      socket.emit("join_lobby_room", response.lobbyId);
      console.log("Successfully created lobby:", response.lobby);
    } else {
      console.error("Failed to create lobby:", response);
      alert(response?.error || "Failed to create lobby");
    }
  });
}

  function joinLobby(lobbyId: string) {
  if (!socket || !socket.connected) {
    alert("Not connected to server");
    return;
  }

  console.log("Joining lobby:", lobbyId);
  socket.emit("join_lobby", lobbyId, (response: any) => {
    console.log("Join lobby response:", response);
    if (response && response.ok) {
      setCurrentLobby(response.lobby);
      socket.emit("join_lobby_room", lobbyId);
      console.log("Successfully joined lobby:", response.lobby);
    } else {
      console.error("Failed to join lobby:", response);
      alert(response?.error || "Failed to join lobby");
    }
  });
}

function leaveLobby() {
  if (!currentLobby || !socket) return;
  
  console.log("Leaving lobby:", currentLobby.id);
  
  // Properly leave the lobby through the server
  socket.emit("leave_lobby", currentLobby.id, (response: any) => {
    if (response.ok) {
      socket.emit("leave_lobby_room", currentLobby.id);
      setCurrentLobby(null);
      refreshLobbyList();
      console.log("Successfully left lobby");
    } else {
      alert(response.error || "Failed to leave lobby");
    }
  });
}

  function refreshLobbyList() {
    if (!socket || !socket.connected) {
      alert("Not connected to server");
      return;
    }
    
    console.log("Refreshing lobby list...");
    socket.emit("get_lobby_list", (response: any) => {
      console.log("Lobby list response:", response);
      if (response && response.ok) {
        setAvailableLobbies(response.lobbies);
      } else {
        console.error("Failed to get lobby list:", response);
      }
    });
  }

  if (!isClient) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
  <div style={{ padding: 20 }}>
    <h2>Game Lobby</h2>
    <div style={{ marginBottom: 20, padding: 10, backgroundColor: "#f8f9fa", borderRadius: 5, color: "#000000" }}>
      <div>Connection Status: <strong>{connectionStatus}</strong></div>
      <div>Socket Connected: <strong>{socket?.connected ? "Yes" : "No"}</strong></div>
      <div>Environment URL: <strong>{import.meta.env.VITE_SERVER_URL}</strong></div>
    </div>
    
    {!currentLobby ? (
      <div>
        <div style={{ marginBottom: 20 }}>
          <button 
            onClick={createLobby}
            disabled={!socket?.connected}
            style={{ 
              marginRight: 10,
              padding: "10px 20px",
              backgroundColor: socket?.connected ? "#007bff" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: socket?.connected ? "pointer" : "not-allowed"
            }}
          >
            Create New Lobby
          </button>
          
          <button 
            onClick={refreshLobbyList}
            disabled={!socket?.connected}
            style={{ 
              padding: "10px 20px",
              backgroundColor: socket?.connected ? "#28a745" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: socket?.connected ? "pointer" : "not-allowed"
            }}
          >
            Refresh ({availableLobbies.length})
          </button>
        </div>

        <h3 style={{ color: "#000000" }}>Available Lobbies:</h3>
        {availableLobbies.length === 0 ? (
          <p style={{ color: "#000000" }}>No lobbies available. Create one to get started!</p>
        ) : (
          <div>
            {availableLobbies.map((lobby) => (
              <div
                key={lobby.id}
                style={{
                  border: "1px solid #ccc",
                  padding: 15,
                  margin: "10px 0",
                  borderRadius: 5,
                  backgroundColor: "#f8f9fa",
                  color: "#000000"
                }}
              >
                <div style={{ color: "#000000" }}><strong>Lobby {lobby.id.slice(0, 8)}</strong></div>
                <div style={{ color: "#000000" }}>Players: {lobby.players.length}/{lobby.max_players}</div>
                <div style={{ color: "#000000" }}>Status: {lobby.status}</div>
                <div style={{ color: "#000000" }}>Players: {lobby.players.map(p => p.username).join(", ") || "None"}</div>
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => joinLobby(lobby.id)}
                    disabled={lobby.players.length >= lobby.max_players}
                    style={{
                      padding: "5px 15px",
                      backgroundColor: lobby.players.length >= lobby.max_players ? "#6c757d" : "#17a2b8",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: lobby.players.length >= lobby.max_players ? "not-allowed" : "pointer"
                    }}
                  >
                    {lobby.players.length >= lobby.max_players ? "Full" : "Join"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : (
      <div style={{ border: "2px solid #007bff", padding: 20, borderRadius: 10, color: "#000000" }}>
        <h3 style={{ color: "#000000" }}>In Lobby: {currentLobby.id.slice(0, 8)}</h3>
        <div style={{ color: "#000000" }}>Status: {currentLobby.status}</div>
        <div style={{ color: "#000000" }}>Players: {currentLobby.players.length}/{currentLobby.max_players}</div>
        <div>
          <h4 style={{ color: "#000000" }}>Players:</h4>
          <ul>
            {currentLobby.players.map((player) => (
              <li key={player.id} style={{ color: "#000000" }}>
                {player.username}
                {player.id === currentLobby.created_by && " (Host)"}
              </li>
            ))}
          </ul>
        </div>
        <button 
          onClick={leaveLobby}
          style={{ 
            padding: "10px 20px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Leave Lobby
      </button>
      </div>
    )}
  </div>
);
}