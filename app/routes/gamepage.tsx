import React, { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

function GamePageContent() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<any>(null);
  const { token } = useAuth();
  const { id } = useParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = io(import.meta.env.VITE_SERVER_URL as string, { auth: { token } });

    const initializeGame = async () => {
      const [Phaser, GameScene] = await Promise.all([
        import("phaser"),
        import("../phaser/GameScene")
      ]);

      const config: any = {
        type: Phaser.default.AUTO,
        width: 900,
        height: 600,
        parent: hostRef.current || undefined,
        scene: new (GameScene.default as any)(socket)
      };

      gameRef.current = new Phaser.default.Game(config);

      if (id) socket.emit("join_game_room", id);
    };

    initializeGame().catch(console.error);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
      }
      socket.disconnect();
    };
  }, [token, id]);

  return <div ref={hostRef} style={{ width: 900, height: 600 }} />;
}

export default function GamePage() {
  return (
    <ProtectedRoute>
      <GamePageContent />
    </ProtectedRoute>
  );
}