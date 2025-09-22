import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/western-theme.css";


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
  const [currentUserId, setCurrentUserId] = useState<string>("");

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

      s.emit("get_user_info", (response: any) => {
      if (response.ok) {
      setCurrentUserId(response.userId);
      }
      });

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

  function startGame() {
    if (!currentLobby || !socket) return;

    if (currentLobby.players.length < 2) {
      alert("Need at least 2 players to start the duel!");
      return;
    }

    console.log("Starting game for lobby:", currentLobby.id);
    socket.emit("start_game", currentLobby.id, (response: any) => {
      console.log("Start game response:", response);
      if (!response.ok) {
        alert(response.error || "Could not start the duel!");
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

  if (!isClient) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", padding: "20px" }}>
      <div className="western-container" style={{ maxWidth: "800px" }}>
        <h1 className="western-title">Card Game Parlor</h1>
        <p className="western-subtitle">Where Bandits Gather to Duel</p>
        
        {/* Connection Status */}
        <div className="western-card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>Saloon Status:</strong> {connectionStatus}
            </div>
            <div style={{ 
              padding: "5px 15px", 
              borderRadius: "20px", 
              background: socket?.connected ? "var(--dusty-gold)" : "var(--gunmetal)",
              color: "var(--aged-paper)",
              fontSize: "12px",
              fontWeight: "bold"
            }}>
              {socket?.connected ? "CONNECTED" : "DISCONNECTED"}
            </div>
          </div>
        </div>

        {!currentLobby ? (
          <div>
            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "15px", marginBottom: "30px", flexWrap: "wrap" }}>
              <button 
                onClick={createLobby}
                disabled={!socket?.connected}
                className="western-btn"
                style={{ flex: "1", minWidth: "200px" }}
              >
                Start New Game Table
              </button>
              
              <button 
                onClick={refreshLobbyList}
                disabled={!socket?.connected}
                className="western-btn"
                style={{ 
                  background: socket?.connected ? "var(--gunmetal)" : "var(--shadow-black)",
                  minWidth: "150px"
                }}
              >
                Scout the Room ({availableLobbies.length})
              </button>
            </div>

            {/* Available Games */}
            <div className="western-card">
              <h3 style={{ 
                color: "var(--dark-wood)", 
                marginBottom: "20px", 
                textAlign: "center",
                borderBottom: "2px solid var(--leather-brown)",
                paddingBottom: "10px"
              }}>
                Open Game Tables
              </h3>
              
              {availableLobbies.length === 0 ? (
                <div style={{ 
                  textAlign: "center", 
                  padding: "40px 20px",
                  fontStyle: "italic",
                  color: "var(--leather-brown)"
                }}>
                  The saloon is quiet... No games in progress.<br/>
                  <span style={{ fontSize: "14px" }}>Be the first to start a table!</span>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "15px" }}>
                  {availableLobbies.map((lobby) => (
                    <div
                      key={lobby.id}
                      style={{
                        background: "linear-gradient(135deg, var(--aged-paper), var(--desert-sand))",
                        border: "2px solid var(--whiskey-amber)",
                        borderRadius: "10px",
                        padding: "20px",
                        position: "relative",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: "18px", 
                            fontWeight: "bold", 
                            color: "var(--dark-wood)",
                            marginBottom: "8px"
                          }}>
                            Table #{lobby.id.slice(0, 8).toUpperCase()}
                          </div>
                          <div style={{ color: "var(--leather-brown)", marginBottom: "5px" }}>
                            Players: {lobby.players.length}/{lobby.max_players}
                          </div>
                          <div style={{ color: "var(--leather-brown)", marginBottom: "10px" }}>
                            Status: <span style={{ 
                              textTransform: "capitalize",
                              fontWeight: "bold"
                            }}>{lobby.status}</span>
                          </div>
                          {lobby.players.length > 0 && (
                            <div style={{ 
                              fontSize: "14px", 
                              color: "var(--dark-wood)",
                              background: "rgba(139, 69, 19, 0.1)",
                              padding: "5px 10px",
                              borderRadius: "5px",
                              marginTop: "10px"
                            }}>
                              <strong>Seated:</strong> {lobby.players.map(p => p.username).join(", ")}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => joinLobby(lobby.id)}
                          disabled={lobby.players.length >= lobby.max_players}
                          className="western-btn"
                          style={{
                            marginLeft: "20px",
                            minWidth: "100px",
                            background: lobby.players.length >= lobby.max_players 
                              ? "var(--gunmetal)" 
                              : "linear-gradient(135deg, var(--dusty-gold), var(--whiskey-amber))"
                          }}
                        >
                          {lobby.players.length >= lobby.max_players ? "Table Full" : "Join Game"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
            /* In Lobby View */
          <div className="western-card" style={{ 
            border: "3px solid var(--dusty-gold)",
            background: "linear-gradient(135deg, var(--whiskey-amber), var(--leather-brown))"
          }}>
            <h2 style={{ 
              color: "var(--aged-paper)", 
              textAlign: "center",
              marginBottom: "20px",
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)"
            }}>
              Your Table: #{currentLobby.id.slice(0, 8).toUpperCase()}
            </h2>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "20px",
              marginBottom: "25px"
            }}>
              <div style={{ 
                background: "var(--aged-paper)", 
                padding: "15px", 
                borderRadius: "8px",
                color: "var(--dark-wood)"
              }}>
                <strong>Status:</strong> {currentLobby.status}
              </div>
              <div style={{ 
                background: "var(--aged-paper)", 
                padding: "15px", 
                borderRadius: "8px",
                color: "var(--dark-wood)"
              }}>
                <strong>Players:</strong> {currentLobby.players.length}/{currentLobby.max_players}
              </div>
            </div>

            <div style={{ 
              background: "var(--aged-paper)", 
              padding: "20px", 
              borderRadius: "10px",
              marginBottom: "25px"
            }}>
              <h4 style={{ 
                color: "var(--dark-wood)", 
                marginBottom: "15px",
                textAlign: "center",
                borderBottom: "1px solid var(--leather-brown)",
                paddingBottom: "10px"
              }}>
                Bandits at the Table
              </h4>
              
              {currentLobby.players.length === 0 ? (
                <p style={{ 
                  textAlign: "center", 
                  color: "var(--leather-brown)",
                  fontStyle: "italic"
                }}>
                  Waiting for players to join...
                </p>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {currentLobby.players.map((player, index) => (
                    <div 
                      key={player.id}
                      style={{
                        padding: "10px 15px",
                        background: player.id === currentLobby.created_by 
                          ? "linear-gradient(135deg, var(--dusty-gold), var(--whiskey-amber))"
                          : "var(--desert-sand)",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        color: "var(--dark-wood)",
                        fontWeight: "bold"
                      }}
                    >
                      <span>
                        {index + 1}. {player.username}
                      </span>
                      {player.id === currentLobby.created_by && (
                        <span style={{ 
                          fontSize: "12px",
                          background: "var(--aged-paper)",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          color: "var(--dark-wood)"
                        }}>
                          TABLE BOSS
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              {currentLobby.created_by === currentUserId && (
              <button 
                onClick={startGame}
                disabled={currentLobby.players.length < 2}
                className="western-btn"
                style={{ 
                  background: currentLobby.players.length >= 2 
                    ? "linear-gradient(135deg, var(--dusty-gold), var(--whiskey-amber))"
                    : "var(--gunmetal)",
                  borderColor: currentLobby.players.length >= 2 ? "var(--dusty-gold)" : "var(--shadow-black)",
                  fontSize: "18px",
                  padding: "15px 30px"
                }}
              >
                {currentLobby.players.length < 2 ? "Need 2 Players" : "Start the Duel!"}
              </button>
            )}
              
              <button 
                onClick={leaveLobby}
                className="western-btn"
                style={{ 
                  background: "linear-gradient(135deg, var(--rusty-red), var(--gunmetal))",
                  borderColor: "var(--shadow-black)",
                  fontSize: "16px",
                  padding: "12px 30px"
                }}
              >
                Leave Table
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}