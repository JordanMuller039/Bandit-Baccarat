import pool from '../database/connection.js';

export interface Lobby {
  id: string;
  created_by: string;
  max_players: number;
  status: 'waiting' | 'playing' | 'finished';
  created_at: Date;
  players: LobbyPlayer[];
}

export interface LobbyPlayer {
  id: string;
  username: string;
  joined_at: Date;
}

export interface LobbyResult {
  success: boolean;
  lobby?: Lobby;
  message?: string;
}

export class LobbyService {
  static async createLobby(userId: string, maxPlayers: number = 4): Promise<LobbyResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create lobby
      const lobbyResult = await client.query(
        'INSERT INTO lobbies (created_by, max_players) VALUES ($1, $2) RETURNING *',
        [userId, maxPlayers]
      );
      
      const lobby = lobbyResult.rows[0];
      
      // Add creator as first player
      await client.query(
        'INSERT INTO lobby_players (lobby_id, user_id) VALUES ($1, $2)',
        [lobby.id, userId]
      );
      
      await client.query('COMMIT');
      
      // Get full lobby data with players
      const fullLobby = await this.getLobbyById(lobby.id);
      
      return {
        success: true,
        lobby: fullLobby!
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create lobby error:', error);
      return { success: false, message: 'Failed to create lobby' };
    } finally {
      client.release();
    }
  }

  static async joinLobby(lobbyId: string, userId: string): Promise<LobbyResult> {
    try {
      // Check if lobby exists and has space
      const lobby = await this.getLobbyById(lobbyId);
      
      if (!lobby) {
        return { success: false, message: 'Lobby not found' };
      }
      
      if (lobby.status !== 'waiting') {
        return { success: false, message: 'Lobby is not accepting new players' };
      }
      
      if (lobby.players.length >= lobby.max_players) {
        return { success: false, message: 'Lobby is full' };
      }
      
      // Check if user is already in lobby
      const isAlreadyInLobby = lobby.players.some(player => player.id === userId);
      if (isAlreadyInLobby) {
        return { success: false, message: 'You are already in this lobby' };
      }
      
      // Add player to lobby
      await pool.query(
        'INSERT INTO lobby_players (lobby_id, user_id) VALUES ($1, $2)',
        [lobbyId, userId]
      );
      
      // Get updated lobby data
      const updatedLobby = await this.getLobbyById(lobbyId);
      
      return {
        success: true,
        lobby: updatedLobby!
      };
    } catch (error) {
      console.error('Join lobby error:', error);
      return { success: false, message: 'Failed to join lobby' };
    }
  }

  static async leaveLobby(lobbyId: string, userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Remove player from lobby
      const result = await pool.query(
        'DELETE FROM lobby_players WHERE lobby_id = $1 AND user_id = $2',
        [lobbyId, userId]
      );
      
      if (result.rowCount === 0) {
        return { success: false, message: 'You are not in this lobby' };
      }
      
      // Check if lobby is now empty
      const remainingPlayers = await pool.query(
        'SELECT COUNT(*) as count FROM lobby_players WHERE lobby_id = $1',
        [lobbyId]
      );
      
      // If no players left, delete the lobby
      if (parseInt(remainingPlayers.rows[0].count) === 0) {
        await pool.query('DELETE FROM lobbies WHERE id = $1', [lobbyId]);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Leave lobby error:', error);
      return { success: false, message: 'Failed to leave lobby' };
    }
  }

  static async getLobbyById(lobbyId: string): Promise<Lobby | null> {
    try {
      const result = await pool.query(`
        SELECT 
          l.*,
          json_agg(
            json_build_object(
              'id', u.id,
              'username', u.username,
              'joined_at', lp.joined_at
            ) ORDER BY lp.joined_at
          ) FILTER (WHERE u.id IS NOT NULL) as players
        FROM lobbies l
        LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
        LEFT JOIN users u ON lp.user_id = u.id
        WHERE l.id = $1
        GROUP BY l.id
      `, [lobbyId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        created_by: row.created_by,
        max_players: row.max_players,
        status: row.status,
        created_at: row.created_at,
        players: row.players || []
      };
    } catch (error) {
      console.error('Get lobby error:', error);
      return null;
    }
  }

  static async getAllActiveLobbies(): Promise<Lobby[]> {
    try {
      const result = await pool.query(`
        SELECT 
          l.*,
          json_agg(
            json_build_object(
              'id', u.id,
              'username', u.username,
              'joined_at', lp.joined_at
            ) ORDER BY lp.joined_at
          ) FILTER (WHERE u.id IS NOT NULL) as players
        FROM lobbies l
        LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
        LEFT JOIN users u ON lp.user_id = u.id
        WHERE l.status = 'waiting'
        GROUP BY l.id
        ORDER BY l.created_at DESC
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        created_by: row.created_by,
        max_players: row.max_players,
        status: row.status,
        created_at: row.created_at,
        players: row.players || []
      }));
    } catch (error) {
      console.error('Get all lobbies error:', error);
      return [];
    }
  }

  static async startGame(lobbyId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  try {
    // Check if user is the lobby creator
    const lobby = await this.getLobbyById(lobbyId);
    
    if (!lobby) {
      return { success: false, message: 'Lobby not found' };
    }
    
    if (lobby.created_by !== userId) {
      return { success: false, message: 'Only the lobby creator can start the game' };
    }
    
    if (lobby.players.length < 2) {
      return { success: false, message: 'Need at least 2 players to start the game' };
    }
    
    // Update lobby status to playing
    await pool.query(
      'UPDATE lobbies SET status = $1 WHERE id = $2',
      ['playing', lobbyId]
    );
    
    console.log(`✅ Game started for lobby ${lobbyId} with ${lobby.players.length} players`);
    return { success: true };
  } catch (error) {
    console.error('Start game error:', error);
    return { success: false, message: 'Failed to start game' };
  }
}
}