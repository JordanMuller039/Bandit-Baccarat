import { Server, Socket } from 'socket.io';
import { AuthService } from '../services/authService.js';
import { LobbyService } from '../services/lobbyService.js';
import { GameService } from '../services/gameService.js';

export function setupSocketHandlers(io: Server) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No token provided'));
      }

      const { valid, userId } = await AuthService.verifyToken(token);
      if (!valid || !userId) {
        return next(new Error('Invalid token'));
      }

      const user = await AuthService.getUserById(userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.user = user;
      socket.data.currentLobbyId = null; // Track user's current lobby
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`✅ User connected: ${socket.data.user.username}`);

    // Join lobby room for real-time updates
    socket.on('join_lobby_room', (lobbyId: string) => {
      socket.join(`lobby_${lobbyId}`);
      socket.data.currentLobbyId = lobbyId;
      console.log(`User ${socket.data.user.username} joined lobby room ${lobbyId}`);
    });

    // Leave lobby room
    socket.on('leave_lobby_room', (lobbyId: string) => {
      socket.leave(`lobby_${lobbyId}`);
      socket.data.currentLobbyId = null;
      console.log(`User ${socket.data.user.username} left lobby room ${lobbyId}`);
    });

    // Create lobby
    socket.on('create_lobby', async (callback) => {
      try {
        const result = await LobbyService.createLobby(socket.data.user.id);
        
        if (result.success && result.lobby) {
          socket.join(`lobby_${result.lobby.id}`);
          socket.data.currentLobbyId = result.lobby.id;
          
          io.emit('lobby_list_updated');
          
          callback({ 
            ok: true, 
            lobbyId: result.lobby.id,
            lobby: result.lobby
          });
        } else {
          callback({ ok: false, error: result.message });
        }
      } catch (error) {
        console.error('Create lobby socket error:', error);
        callback({ ok: false, error: 'Failed to create lobby' });
      }
    });

    // Join lobby
    socket.on('join_lobby', async (lobbyId: string, callback) => {
      try {
        const result = await LobbyService.joinLobby(lobbyId, socket.data.user.id);
        
        if (result.success && result.lobby) {
          socket.join(`lobby_${lobbyId}`);
          socket.data.currentLobbyId = lobbyId;
          
          io.to(`lobby_${lobbyId}`).emit('lobby_update', {
            type: 'player_joined',
            lobby: result.lobby,
            player: socket.data.user
          });
          
          io.emit('lobby_list_updated');
          
          callback({ ok: true, lobby: result.lobby });
        } else {
          callback({ ok: false, error: result.message });
        }
      } catch (error) {
        console.error('Join lobby socket error:', error);
        callback({ ok: false, error: 'Failed to join lobby' });
      }
    });

    // Leave lobby explicitly
    socket.on('leave_lobby', async (lobbyId: string, callback) => {
      try {
        const result = await LobbyService.leaveLobby(lobbyId, socket.data.user.id);
        
        if (result.success) {
          socket.leave(`lobby_${lobbyId}`);
          socket.data.currentLobbyId = null;
          
          // Notify remaining players
          io.to(`lobby_${lobbyId}`).emit('lobby_update', {
            type: 'player_left',
            player: socket.data.user
          });
          
          io.emit('lobby_list_updated');
          
          callback({ ok: true });
        } else {
          callback({ ok: false, error: result.message });
        }
      } catch (error) {
        console.error('Leave lobby socket error:', error);
        callback({ ok: false, error: 'Failed to leave lobby' });
      }
    });

    // Start game
    socket.on('start_game', async (lobbyId: string, callback) => {
  try {
    const result = await LobbyService.startGame(lobbyId, socket.data.user.id);
    
    if (result.success) {
      // Get lobby players
      const lobby = await LobbyService.getLobbyById(lobbyId);
      if (!lobby) {
        return callback({ ok: false, error: 'Lobby not found' });
      }

      // Create game state with actual players
      const playerData = lobby.players.map(p => ({
        id: p.id,
        username: p.username
      }));

      const gameState = await GameService.createNewGame(lobbyId, playerData);
      
      // Notify all players in the lobby that the game is starting
      io.to(`lobby_${lobbyId}`).emit('game_started', {
        lobbyId: lobbyId
      });

      // Send initial game state (dealing phase)
      setTimeout(() => {
        io.to(`lobby_${lobbyId}`).emit('game_state_update', gameState);
        
        // Progress to selection phase after dealing animation
        setTimeout(() => {
          const updatedState = GameService.progressToSelection(lobbyId);
          if (updatedState) {
            io.to(`game_${lobbyId}`).emit('game_state_update', updatedState);
          }
        }, 3000); // 3 seconds for dealing animation
        
      }, 500);
      
      // Update lobby list for other users
      io.emit('lobby_list_updated');
      
      callback({ ok: true });
    } else {
      callback({ ok: false, error: result.message });
    }
  } catch (error) {
    console.error('Start game socket error:', error);
    callback({ ok: false, error: 'Failed to start game' });
  }
});

    // Get user info
    socket.on('get_user_info', (callback) => {
      callback({ 
        ok: true, 
        userId: socket.data.user.id,
        username: socket.data.user.username 
      });
    });

    // Join game
    socket.on('join_game', (lobbyId: string) => {
      console.log(`Player ${socket.data.user.username} joining game ${lobbyId}`);
      
      // Join the game room
      socket.join(`game_${lobbyId}`);
      
      // Send current game state if it exists
      const gameState = GameService.getGame(lobbyId);
      if (gameState) {
        socket.emit('game_state_update', gameState);
      }
      
      // Send user info
      socket.emit('user_info', {
        userId: socket.data.user.id,
        username: socket.data.user.username
      });
    });

    // Select card
    socket.on('select_card', ({ gameId, cardId }) => {
      const gameState = GameService.getGame(gameId);
      if (!gameState || gameState.phase !== 'selection') return;

      const player = gameState.players.find(p => p.id === socket.data.user.id);
      if (!player || player.selectedCard) return;

      // Mark card as selected
      player.selectedCard = cardId;
      const selectedCard = player.cards.find(c => c.id === cardId);
      if (selectedCard) {
        selectedCard.faceUp = true;
      }

      gameState.lastAction = `${player.username} has chosen their card!`;

      // Check if all players have selected cards
      const allSelected = gameState.players.every(p => p.selectedCard);
      if (allSelected) {
        gameState.phase = 'quickdraw';
        gameState.lastAction = 'Both bandits show their iron! Quick, call SWAP or KEEP!';
      }

      GameService.updateGame(gameId, gameState);
      io.to(`game_${gameId}`).emit('game_state_update', gameState);
    });

    // Quickdraw action
    socket.on('quickdraw_action', ({ gameId, action, playerId }) => {
      const gameState = GameService.getGame(gameId);
      if (!gameState || gameState.phase !== 'quickdraw') return;

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.action) return;

      player.action = action;
      gameState.quickDrawCaller = playerId;
      gameState.lastAction = `${player.username} calls ${action.toUpperCase()}! The other player must do the opposite.`;

      // Set opposite action for other player
      const otherPlayer = gameState.players.find(p => p.id !== playerId);
      if (otherPlayer) {
        otherPlayer.action = action === 'swap' ? 'keep' : 'swap';
      }

      gameState.phase = 'resolution';
      gameState.lastAction = 'Actions locked in! Resolving the duel...';

      GameService.updateGame(gameId, gameState);
      io.to(`game_${gameId}`).emit('game_state_update', gameState);

      // Auto-resolve after a short delay
      setTimeout(() => {
        resolveRound(gameId, io);
      }, 2000);
    });

    // Get lobby list
    socket.on('get_lobby_list', async (callback) => {
      try {
        const lobbies = await LobbyService.getAllActiveLobbies();
        callback({ ok: true, lobbies });
      } catch (error) {
        console.error('Get lobby list error:', error);
        callback({ ok: false, error: 'Failed to get lobby list' });
      }
    });

    // Handle disconnect - AUTOMATIC CLEANUP
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.data.user.username}`);
      
      // If user was in a lobby, remove them automatically
      if (socket.data.currentLobbyId) {
        try {
          console.log(`Automatically removing ${socket.data.user.username} from lobby ${socket.data.currentLobbyId}`);
          
          const result = await LobbyService.leaveLobby(socket.data.currentLobbyId, socket.data.user.id);
          
          if (result.success) {
            // Notify remaining players in the lobby
            io.to(`lobby_${socket.data.currentLobbyId}`).emit('lobby_update', {
              type: 'player_disconnected',
              player: socket.data.user
            });
            
            // Update lobby list for all clients
            io.emit('lobby_list_updated');
            
            console.log(`✅ Successfully removed ${socket.data.user.username} from lobby`);
          }
        } catch (error) {
          console.error('Error during disconnect cleanup:', error);
        }
      }
    });
  });
}

// Helper function to resolve rounds
function resolveRound(gameId: string, io: Server) {
  const gameState = GameService.getGame(gameId);
  if (!gameState) return;

  // For now, just reveal all cards and declare a winner
  gameState.players.forEach(player => {
    player.cards.forEach(card => {
      card.faceUp = true;
    });
    player.score = calculateScore(player.cards);
  });

  const [player1, player2] = gameState.players;
  if (player1.score > player2.score) {
    gameState.winner = player1.id;
    gameState.lastAction = `${player1.username} wins with ${player1.score}!`;
  } else if (player2.score > player1.score) {
    gameState.winner = player2.id;
    gameState.lastAction = `${player2.username} wins with ${player2.score}!`;
  } else {
    gameState.lastAction = `Tie game! Both players scored ${player1.score}`;
  }

  gameState.phase = 'finished';
  GameService.updateGame(gameId, gameState);
  io.to(`game_${gameId}`).emit('game_state_update', gameState);
}

function calculateScore(cards: any[]): number {
  const total = cards.reduce((sum, card) => {
    if (card.value === 'A') return sum + 1;
    if (['J', 'Q', 'K'].includes(card.value)) return sum + 0;
    return sum + (parseInt(card.value) || 10);
  }, 0);
  return total % 10;
}