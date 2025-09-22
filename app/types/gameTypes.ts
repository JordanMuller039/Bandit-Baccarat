export interface PlayingCard {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  faceUp: boolean;
  id: string;
}

export interface Player {
  id: string;
  username: string;
  cards: PlayingCard[];
  selectedCard?: string; // card id
  action?: 'swap' | 'keep';
  score: number;
  isReady: boolean;
}

export interface GameState {
  gameId: string;
  phase: 'waiting' | 'dealing' | 'selection' | 'quickdraw' | 'resolution' | 'drawing' | 'finished' | 'tiebreaker';
  players: Player[];
  currentPlayer?: string; // whose turn it is
  quickDrawCaller?: string; // who called first
  discardPile: PlayingCard[];
  deck: PlayingCard[];
  winner?: string;
  roundNumber: number;
  lastAction?: string;
  tiebreaker?: {
    phase: 'rolling' | 'picking';
    diceRolls: { [playerId: string]: number };
    sharedPile: PlayingCard[];
    pickOrder: string[];
  };
}