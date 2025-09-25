
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../database/connection.js';

const router = express.Router();

// Type guard for database errors
const isDatabaseError = (error: unknown): error is { code: string; message: string } => {
  return error != null && typeof error === 'object' && 'code' in error;
};

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// XP and Level Calculation Helpers
const calculateLevel = (xp: number): number => {
  let level = 1;
  let requiredXP = 100; // XP needed for level 2
  let totalXPNeeded = requiredXP;

  while (xp >= totalXPNeeded) {
    level++;
    requiredXP = Math.floor(requiredXP * 1.5); 
    totalXPNeeded += requiredXP;
  }

  return level;
};

const getXPToNextLevel = (xp: number): number => {
  const currentLevel = calculateLevel(xp);
  let requiredXP = 100;
  let totalXPForCurrentLevel = 0;
  let totalXPForNextLevel = requiredXP;

  for (let i = 1; i < currentLevel; i++) {
    totalXPForCurrentLevel += requiredXP;
    requiredXP = Math.floor(requiredXP * 1.5);
    totalXPForNextLevel = totalXPForCurrentLevel + requiredXP;
  }

  return totalXPForNextLevel - xp;
};

// Award XP and update level
const awardXP = async (userId: string, xpAmount: number) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current XP
    const userResult = await client.query('SELECT xp FROM users WHERE id = $1', [userId]);
    const currentXP = userResult.rows[0].xp;
    const newXP = currentXP + xpAmount;
    const newLevel = calculateLevel(newXP);

    // Update user XP and level
    await client.query(
      'UPDATE users SET xp = $1, level = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newXP, newLevel, userId]
    );

    await client.query('COMMIT');
    return { newXP, newLevel };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Check and award badges
const checkAndAwardBadges = async (userId: string) => {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      'SELECT total_games, games_won, perfect_nines FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    // Get badge IDs by name to avoid hardcoding UUIDs
    const badgeResult = await client.query(
      `SELECT name, id FROM badges WHERE name IN 
       ('First Steps', 'Getting Started', 'Quarter Century', 'Half Century', 'Centurion', 'Perfect Nine')`
    );
    
    const badgeMap = badgeResult.rows.reduce((map: any, badge: any) => {
      map[badge.name] = badge.id;
      return map;
    }, {});

    const badgesToAward = [];

    // Game count badges
    if (user.total_games === 1 && badgeMap['First Steps']) badgesToAward.push(badgeMap['First Steps']);
    if (user.total_games === 10 && badgeMap['Getting Started']) badgesToAward.push(badgeMap['Getting Started']);
    if (user.total_games === 25 && badgeMap['Quarter Century']) badgesToAward.push(badgeMap['Quarter Century']);
    if (user.total_games === 50 && badgeMap['Half Century']) badgesToAward.push(badgeMap['Half Century']);
    if (user.total_games === 100 && badgeMap['Centurion']) badgesToAward.push(badgeMap['Centurion']);

    // Perfect Nine badge
    if (user.perfect_nines > 0 && badgeMap['Perfect Nine']) badgesToAward.push(badgeMap['Perfect Nine']);

    // Award badges that haven't been earned yet
    for (const badgeId of badgesToAward) {
      await client.query(
        `INSERT INTO user_badges (user_id, badge_id) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, badgeId]
      );
    }
  } catch (error) {
    console.error('Error checking badges:', error);
  } finally {
    client.release();
  }
};

// API Routes

// Get user profile stats
router.get('/profile/stats', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id || req.user.userId; // Handle different token structures
    const result = await pool.query(
      `SELECT username, level, xp, games_won, games_lost, games_drawn, 
              total_games, perfect_nines, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const winRate = user.total_games > 0 ? (user.games_won / user.total_games) * 100 : 0;
    const xpToNext = getXPToNextLevel(user.xp);

    res.json({
      level: user.level,
      xp: user.xp,
      xpToNext,
      gamesWon: user.games_won,
      gamesLost: user.games_lost,
      gamesDrawn: user.games_drawn,
      totalGames: user.total_games,
      winRate,
      perfectNines: user.perfect_nines
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user badges
router.get('/profile/badges', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      `SELECT b.id, b.name, b.description, b.icon, b.category, b.rarity, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friends list
router.get('/profile/friends', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      `SELECT u.id, u.username, u.level, u.status, u.avatar_url
       FROM friendships f
       JOIN users u ON (
         CASE 
           WHEN f.requester_id = $1 THEN f.addressee_id = u.id
           ELSE f.requester_id = u.id
         END
       )
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) 
       AND f.status = 'accepted'
       ORDER BY u.username`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending friend requests
router.get('/profile/friend-requests', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      `SELECT f.id, u.username as requester_username, f.requester_id, f.created_at
       FROM friendships f
       JOIN users u ON f.requester_id = u.id
       WHERE f.addressee_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search for users
router.get('/users/search', authenticateToken, async (req: any, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.id || req.user.userId;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT id, username, level 
       FROM users 
       WHERE username ILIKE $1 
       AND id != $2
       AND id NOT IN (
         SELECT CASE 
           WHEN requester_id = $2 THEN addressee_id 
           ELSE requester_id 
         END
         FROM friendships 
         WHERE (requester_id = $2 OR addressee_id = $2)
         AND status IN ('accepted', 'pending')
       )
       LIMIT 10`,
      [`%${q}%`, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/friends/request', authenticateToken, async (req: any, res) => {
  try {
    const requesterId = req.user.id || req.user.userId;
    const { userId } = req.body;

    if (requesterId === userId) {
      return res.status(400).json({ error: 'Cannot add yourself as friend' });
    }

    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status) 
       VALUES ($1, $2, 'pending')`,
      [requesterId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending friend request:', error);
    if (isDatabaseError(error) && error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/friends/accept/:requestId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { requestId } = req.params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update friendship status
      const result = await client.query(
        `UPDATE friendships 
         SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
         RETURNING requester_id`,
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Friend request not found' });
      }

      const requesterId = result.rows[0].requester_id;

      // Get "Best Friends <3" badge ID
      const badgeResult = await client.query(
        `SELECT id FROM badges WHERE name = 'Best Friends <3' LIMIT 1`
      );

      if (badgeResult.rows.length > 0) {
        const badgeId = badgeResult.rows[0].id;
        // Award "Best Friends <3" badge to both users
        await client.query(
          `INSERT INTO user_badges (user_id, badge_id) 
           VALUES ($1, $2), ($3, $2) 
           ON CONFLICT (user_id, badge_id) DO NOTHING`,
          [userId, badgeId, requesterId]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Game completion handler (call this when a game ends)
router.post('/game/complete', authenticateToken, async (req: any, res) => {
  try {
    const { gameId, result, finalScore, placement, perfectNine = false } = req.body;
    const userId = req.user.id || req.user.userId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Calculate XP based on result and placement
      let xpEarned = 10; // Base XP for playing
      if (result === 'win') xpEarned += 50;
      if (result === 'draw') xpEarned += 25;
      if (placement === 1) xpEarned += 30;
      if (perfectNine) xpEarned += 100;

      // Award XP and get new level
      const newStats = await awardXP(userId, xpEarned);

      // Update user stats
      let updateQuery = `
        UPDATE users SET 
          total_games = total_games + 1,
          updated_at = CURRENT_TIMESTAMP
      `;
      const updateParams = [userId];

      if (result === 'win') {
        updateQuery += ', games_won = games_won + 1';
      } else if (result === 'loss') {
        updateQuery += ', games_lost = games_lost + 1';
      } else if (result === 'draw') {
        updateQuery += ', games_drawn = games_drawn + 1';
      }

      if (perfectNine) {
        updateQuery += ', perfect_nines = perfect_nines + 1';
      }

      updateQuery += ' WHERE id = $1';

      await client.query(updateQuery, updateParams);

      // Record game participation if game exists
      const gameExists = await client.query('SELECT id FROM games WHERE id = $1', [gameId]);
      if (gameExists.rows.length > 0) {
        await client.query(
          `INSERT INTO game_participants (game_id, user_id, final_score, placement, xp_earned)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (game_id, user_id) DO UPDATE SET
           final_score = $3, placement = $4, xp_earned = $5`,
          [gameId, userId, finalScore, placement, xpEarned]
        );
      }

      // Check and award badges
      await checkAndAwardBadges(userId);

      await client.query('COMMIT');
      res.json({ success: true, xpEarned, newLevel: newStats.newLevel });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error completing game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;