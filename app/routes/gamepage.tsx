import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import type { GameState, PlayingCard, Player } from "../types/gameTypes";
import "../styles/western-theme.css";

export default function GamePage() {
  const { token } = useAuth();
  const { id: lobbyId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const s = io(import.meta.env.VITE_SERVER_URL as string, { auth: { token } });
    setSocket(s);

    s.on("connect", () => {
      console.log("Connected to game server");
      if (lobbyId) {
        s.emit("join_game", lobbyId);
      }
    });

    s.on("game_state_update", (state: GameState) => {
      console.log("Game state updated:", state);
      setGameState(state);
    });

    s.on("user_info", (info: { userId: string, username: string }) => {
      setCurrentUser(info.userId);
    });

    s.on("game_error", (error: string) => {
      alert(error);
    });

    return () => {
      s.disconnect();
    };
  }, [token, lobbyId, isClient]);

  const getCurrentPlayer = (): Player | null => {
    if (!gameState || !currentUser) return null;
    return gameState.players.find(p => p.id === currentUser) || null;
  };

  const getOpponent = (): Player | null => {
    if (!gameState || !currentUser) return null;
    return gameState.players.find(p => p.id !== currentUser) || null;
  };

  const handleCardSelect = (cardId: string) => {
    if (gameState?.phase !== 'selection') return;
    if (!socket) return;
    
    setSelectedCard(cardId);
    socket.emit("select_card", { gameId: gameState.gameId, cardId });
  };

  const handleQuickdraw = (action: 'swap' | 'keep') => {
    if (gameState?.phase !== 'quickdraw') return;
    if (!socket) return;
    
    socket.emit("quickdraw_action", { 
      gameId: gameState.gameId, 
      action,
      playerId: currentUser 
    });
  };

  const renderCard = (card: PlayingCard, onClick?: () => void) => {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }[card.suit];

  return (
    <div
      key={card.id}
      className={`playing-card ${card.faceUp ? (isRed ? 'red' : 'black') : 'face-down'} ${
        selectedCard === card.id ? 'selected' : ''
      } ${gameState?.phase === 'dealing' ? 'card-dealing' : ''}`}
      onClick={onClick}
    >
      {card.faceUp && (
        <div style={{ textAlign: 'center' }}>
          <div>{card.value}</div>
          <div style={{ fontSize: '20px' }}>{suitSymbol}</div>
        </div>
      )}
    </div>
  );
};

  const getCardValue = (card: PlayingCard): number => {
    if (card.value === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.value)) return 0;
    return parseInt(card.value) || 10;
  };

  const calculateScore = (cards: PlayingCard[]): number => {
    const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
    return total % 10;
  };

  if (!isClient) {
    return <div style={{ padding: 20 }}>Loading game...</div>;
  }

  if (!gameState) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="western-container">
          <h1 className="western-title">Joining the Duel...</h1>
          <p className="western-subtitle">Preparing the cards and checking your iron</p>
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button 
              className="western-btn" 
              onClick={() => navigate("/lobby")}
            >
              Return to Parlor
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const opponent = getOpponent();

  return (
    <div style={{ minHeight: "100vh", padding: "20px", background: "var(--saloon-brown)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Game Header */}
        <div className="game-info">
          <h2 style={{ margin: "0 0 10px 0", color: "var(--dark-wood)" }}>
            Bandit Baccarat Duel
          </h2>
          <div className="phase-indicator">
            Phase: {gameState.phase.toUpperCase()}
          </div>
          {gameState.lastAction && (
            <div style={{ fontSize: "14px", fontStyle: "italic", marginTop: "5px" }}>
              {gameState.lastAction}
            </div>
          )}
        </div>

        {/* Game Table */}
        <div className="game-table">
          {/* Opponent Area */}
          {opponent && (
            <div className="player-area top">
              <h3 style={{ color: "var(--aged-paper)", margin: "0 0 10px 0" }}>
                {opponent.username}
              </h3>
              <div className="player-hand">
                {opponent.cards.map((card) => renderCard(card))}
              </div>
              <div className="score-display">
                Score: {calculateScore(opponent.cards.filter(c => c.faceUp))}
              </div>
            </div>
          )}

          {/* Center Action Area */}
          {gameState.phase === 'quickdraw' && currentPlayer && !currentPlayer.action && (
            <div className="quickdraw-actions">
              <button 
                className="quickdraw-btn"
                onClick={() => handleQuickdraw('swap')}
              >
                SWAP
              </button>
              <button 
                className="quickdraw-btn"
                onClick={() => handleQuickdraw('keep')}
              >
                KEEP
              </button>
            </div>
          )}

          {gameState.phase === 'selection' && currentPlayer && !currentPlayer.selectedCard && (
            <div style={{ 
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(139, 69, 19, 0.9)",
              padding: "20px",
              borderRadius: "10px",
              color: "var(--aged-paper)",
              textAlign: "center"
            }}>
              <h3>Choose a card to reveal</h3>
              <p>Select one of your cards to show in the duel</p>
            </div>
          )}

          {/* Current Player Area */}
          {currentPlayer && (
            <div className="player-area bottom">
              <h3 style={{ color: "var(--aged-paper)", margin: "0 0 10px 0" }}>
                {currentPlayer.username} (You)
              </h3>
              <div className="player-hand">
                {currentPlayer.cards.map((card) => 
                  renderCard(card, () => handleCardSelect(card.id))
                )}
              </div>
              <div className="score-display">
                Score: {calculateScore(currentPlayer.cards.filter(c => c.faceUp))}
              </div>
              {currentPlayer.action && (
                <div style={{ 
                  color: "var(--dusty-gold)", 
                  fontWeight: "bold",
                  marginTop: "10px"
                }}>
                  Action: {currentPlayer.action.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Game Controls */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button 
            className="western-btn"
            onClick={() => navigate("/lobby")}
            style={{ 
              background: "var(--gunmetal)",
              borderColor: "var(--shadow-black)"
            }}
          >
            Leave Duel
          </button>
        </div>
      </div>
    </div>
  );
}