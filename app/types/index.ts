export interface User {
  id: string;
  username: string;
}

export interface Player {
  id: string;
  username: string;
  // Add other player properties
}

export interface GameState {
  lobbyId: string;
  players: Player[];
  // Add other game state properties
}

export interface LobbyData {
  players: Player[];
}