import { Server, Socket } from 'socket.io';
import { AuthService } from '../services/authService.js';
import { LobbyService } from '../services/lobbyService.js';

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
          io.to(`lobby_${lobbyId}`).emit('game_started', {
            lobbyId: lobbyId
          });
          
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