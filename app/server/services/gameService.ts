import { v4 as uuidv4 } from 'uuid';

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
  selectedCard?: string;
  action?: 'swap' | 'keep';
  score: number;
  isReady: boolean;
}

export interface GameState {
  gameId: string;
  phase: 'waiting' | 'dealing' | 'selection' | 'quickdraw' | 'resolution' | 'drawing' | 'finished' | 'tiebreaker' | 'perfect_chamber';
  players: Player[];
  currentPlayer?: string;
  quickDrawCaller?: string;
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
    currentPicker?: string;
  };
}

export class GameService {
  private static games = new Map<string, GameState>();

  static createDeck(): PlayingCard[] {
    const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values: ('A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K')[] = 
      ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    const deck: PlayingCard[] = [];
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          suit,
          value,
          faceUp: false,
          id: uuidv4()
        });
      }
    }
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  static getCardValue(card: PlayingCard): number {
    if (card.value === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.value)) return 0;
    return parseInt(card.value) || 10;
  }

  static calculateScore(cards: PlayingCard[]): number {
    const total = cards.reduce((sum, card) => sum + this.getCardValue(card), 0);
    return total % 10;
  }

  static async createNewGame(lobbyId: string, playerData: { id: string, username: string }[]): Promise<GameState> {
    const deck = this.createDeck();
    const discardPile: PlayingCard[] = [];
    
    // Create players with initial empty hands
    const players: Player[] = playerData.map(p => ({
      id: p.id,
      username: p.username,
      cards: [],
      score: 0,
      isReady: false
    }));

    const gameState: GameState = {
      gameId: lobbyId,
      phase: 'dealing',
      players,
      deck,
      discardPile,
      roundNumber: 1,
      lastAction: 'Game started! Dealing cards...'
    };

    // Deal 2 cards to each player (face down)
    for (let i = 0; i < 2; i++) {
      for (const player of players) {
        const card = deck.pop();
        if (card) {
          player.cards.push(card);
        }
      }
    }

    this.games.set(lobbyId, gameState);
    return gameState;
  }

  static progressToSelection(gameId: string): GameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.phase !== 'dealing') return null;

    // Check for Perfect Chamber (9 with first 2 cards)
    for (const player of gameState.players) {
      const score = this.calculateScore(player.cards);
      if (score === 9) {
        gameState.phase = 'perfect_chamber';
        gameState.winner = player.id;
        gameState.lastAction = `🔫 PERFECT CHAMBER! ${player.username} draws a perfect 9!`;
        // Reveal all cards
        gameState.players.forEach(p => {
          p.cards.forEach(c => c.faceUp = true);
          p.score = this.calculateScore(p.cards);
        });
        this.games.set(gameId, gameState);
        return gameState;
      }
    }

    gameState.phase = 'selection';
    gameState.lastAction = 'Choose one card to reveal for the duel!';
    this.games.set(gameId, gameState);
    return gameState;
  }

  static selectCard(gameId: string, playerId: string, cardId: string): GameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.phase !== 'selection') return null;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.selectedCard) return null;

    // Mark card as selected but DON'T reveal it yet
    player.selectedCard = cardId;
    gameState.lastAction = `${player.username} has chosen their card...`;

    // Check if all players have selected cards
    const allSelected = gameState.players.every(p => p.selectedCard);
    if (allSelected) {
      // NOW reveal the selected cards
      gameState.players.forEach(p => {
        const selectedCard = p.cards.find(c => c.id === p.selectedCard);
        if (selectedCard) {
          selectedCard.faceUp = true;
        }
      });
      
      gameState.phase = 'quickdraw';
      gameState.lastAction = 'Both bandits show their cards! Quick, call SWAP or KEEP!';
    }

    this.games.set(gameId, gameState);
    return gameState;
  }

  static performQuickdraw(gameId: string, playerId: string, action: 'swap' | 'keep'): GameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.phase !== 'quickdraw') return null;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.action) return null;

    player.action = action;
    gameState.quickDrawCaller = playerId;
    
    // Set opposite action for other player
    const otherPlayer = gameState.players.find(p => p.id !== playerId);
    if (otherPlayer) {
      otherPlayer.action = action === 'swap' ? 'keep' : 'swap';
    }

    gameState.lastAction = `${player.username} calls ${action.toUpperCase()}! ${otherPlayer?.username} must ${action === 'swap' ? 'KEEP' : 'SWAP'}!`;
    gameState.phase = 'resolution';

    this.games.set(gameId, gameState);
    return gameState;
  }

  static resolveActions(gameId: string): GameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.phase !== 'resolution') return null;

    // Execute swap/keep actions
    for (const player of gameState.players) {
      if (player.action === 'swap') {
        // Remove selected card and draw new one
        const selectedCardIndex = player.cards.findIndex(c => c.id === player.selectedCard);
        if (selectedCardIndex !== -1) {
          const discardedCard = player.cards.splice(selectedCardIndex, 1)[0];
          gameState.discardPile.push(discardedCard);
          
          // Draw new card
          const newCard = gameState.deck.pop();
          if (newCard) {
            newCard.faceUp = true; // New card is revealed
            player.cards.push(newCard);
          }
        }
      }
      // If keep, selected card stays revealed
    }

    // Reveal all cards and calculate scores
    gameState.players.forEach(player => {
      player.cards.forEach(card => card.faceUp = true);
      player.score = this.calculateScore(player.cards);
    });

    // Check for automatic draw (5 or below draws third card)
    for (const player of gameState.players) {
      if (player.score <= 5) {
        const thirdCard = gameState.deck.pop();
        if (thirdCard) {
          thirdCard.faceUp = true;
          player.cards.push(thirdCard);
          player.score = this.calculateScore(player.cards);
        }
      }
    }

    // Determine winner or tie
    const [player1, player2] = gameState.players;
    if (player1.score > player2.score) {
      gameState.winner = player1.id;
      gameState.phase = 'finished';
      gameState.lastAction = `${player1.username} wins with ${player1.score}!`;
    } else if (player2.score > player1.score) {
      gameState.winner = player2.id;
      gameState.phase = 'finished';
      gameState.lastAction = `${player2.username} wins with ${player2.score}!`;
    } else {
      // Tie - start tiebreaker
      gameState.phase = 'tiebreaker';
      gameState.tiebreaker = {
        phase: 'rolling',
        diceRolls: {},
        sharedPile: [...player1.cards, ...player2.cards],
        pickOrder: []
      };
      gameState.lastAction = `Tie at ${player1.score}! Roll dice to see who picks first!`;
      
      // Clear player cards
      gameState.players.forEach(p => p.cards = []);
    }

    this.games.set(gameId, gameState);
    return gameState;
  }

  static rollDice(gameId: string, playerId: string): GameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.phase !== 'tiebreaker' || !gameState.tiebreaker) return null;
    if (gameState.tiebreaker.phase !== 'rolling') return null;

    const diceRoll = Math.floor(Math.random() * 6) + 1;
    gameState.tiebreaker.diceRolls[playerId] = diceRoll;

    const player = gameState.players.find(p => p.id === playerId);
    gameState.lastAction = `${player?.username} rolled a ${diceRoll}!`;

    // Check if all players have rolled
    if (Object.keys(gameState.tiebreaker.diceRolls).length === gameState.players.length) {
      // Determine pick order
      const sortedRolls = Object.entries(gameState.tiebreaker.diceRolls)
        .sort(([,a], [,b]) => b - a);
      
      gameState.tiebreaker.pickOrder = sortedRolls.map(([id]) => id);
      gameState.tiebreaker.phase = 'picking';
      gameState.tiebreaker.currentPicker = gameState.tiebreaker.pickOrder[0];
      
      const firstPicker = gameState.players.find(p => p.id === gameState.tiebreaker!.currentPicker);
      gameState.lastAction = `${firstPicker?.username} picks first!`;
    }

    this.games.set(gameId, gameState);
    return gameState;
  }

  static pickCard(gameId: string, playerId: string, cardId: string): GameState | null {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.phase !== 'tiebreaker' || !gameState.tiebreaker) return null;
    if (gameState.tiebreaker.phase !== 'picking') return null;
    if (gameState.tiebreaker.currentPicker !== playerId) return null;

    const player = gameState.players.find(p => p.id === playerId);
    const cardIndex = gameState.tiebreaker.sharedPile.findIndex(c => c.id === cardId);
    
    if (cardIndex === -1) return null;

    // Move card to player hand (face down initially)
    const pickedCard = gameState.tiebreaker.sharedPile.splice(cardIndex, 1)[0];
    pickedCard.faceUp = false;
    player!.cards.push(pickedCard);

    // Move to next picker or reveal
    const currentPickerIndex = gameState.tiebreaker.pickOrder.indexOf(playerId);
    if (currentPickerIndex < gameState.tiebreaker.pickOrder.length - 1) {
      gameState.tiebreaker.currentPicker = gameState.tiebreaker.pickOrder[currentPickerIndex + 1];
      const nextPicker = gameState.players.find(p => p.id === gameState.tiebreaker!.currentPicker);
      gameState.lastAction = `${player?.username} picked a card. ${nextPicker?.username}'s turn!`;
    } else {
      // All picked, reveal and determine winner
      gameState.players.forEach(p => {
        p.cards.forEach(c => c.faceUp = true);
        p.score = this.calculateScore(p.cards);
      });

      const [p1, p2] = gameState.players;
      if (p1.score > p2.score) {
        gameState.winner = p1.id;
        gameState.phase = 'finished';
        gameState.lastAction = `${p1.username} wins the tiebreaker with ${p1.score}!`;
      } else if (p2.score > p1.score) {
        gameState.winner = p2.id;
        gameState.phase = 'finished';
        gameState.lastAction = `${p2.username} wins the tiebreaker with ${p2.score}!`;
      } else {
        // Another tie - restart tiebreaker
        gameState.tiebreaker = {
          phase: 'rolling',
          diceRolls: {},
          sharedPile: [...p1.cards, ...p2.cards],
          pickOrder: []
        };
        gameState.players.forEach(p => p.cards = []);
        gameState.lastAction = `Another tie! Roll again!`;
      }
    }

    this.games.set(gameId, gameState);
    return gameState;
  }

  static async rematch(gameId: string): Promise<GameState | null> {
  const gameState = this.games.get(gameId);
  if (!gameState || gameState.phase !== 'finished') return null;

  // Reset game state but keep players
  const playerData = gameState.players.map(p => ({ id: p.id, username: p.username }));
  const newGameState = await this.createNewGame(gameId, playerData);
  return newGameState;
}

  static getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  static updateGame(gameId: string, gameState: GameState): void {
    this.games.set(gameId, gameState);
  }

  static deleteGame(gameId: string): void {
    this.games.delete(gameId);
  }
}