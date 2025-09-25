-- Complete Enhanced Schema for Bandit-Baccarat
-- This replaces your existing schema.sql entirely

-- Enhanced Users table with all original + new columns
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Level & XP System
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    
    -- Game Statistics
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_drawn INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    perfect_nines INTEGER DEFAULT 0,
    
    -- Profile Info
    avatar_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'offline', -- online, offline, in-game
    bio TEXT
);

-- Game lobbies table (your original)
CREATE TABLE IF NOT EXISTS lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    max_players INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, playing, finished
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lobby players table (your original)
CREATE TABLE IF NOT EXISTS lobby_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lobby_id, user_id)
);

-- Enhanced Games table (your original + new columns)
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
    game_state JSONB,
    status VARCHAR(20) DEFAULT 'active', -- active, finished
    winner_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    
    -- New columns
    game_type VARCHAR(50) DEFAULT 'bandit-baccarat',
    result VARCHAR(20), -- win, draw, abandoned
    rounds_played INTEGER DEFAULT 0,
    xp_awarded INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Friends System
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
);

-- Badge Definitions
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(100), -- icon filename or emoji
    category VARCHAR(50), -- games, social, achievements
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Badges (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, badge_id)
);

-- Game Participants (tracks individual player performance)
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    final_score INTEGER DEFAULT 0,
    placement INTEGER, -- 1st, 2nd, 3rd place
    xp_earned INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(game_id, user_id)
);

-- Insert Default Badges
INSERT INTO badges (name, description, icon, category, rarity) 
SELECT name, description, icon, category, rarity FROM (VALUES
    ('First Steps', 'Play your first game of Bandit Baccarat', '🎮', 'games', 'common'),
    ('Getting Started', 'Play 10 games', '🎯', 'games', 'common'),
    ('Quarter Century', 'Play 25 games', '🏆', 'games', 'rare'),
    ('Half Century', 'Play 50 games', '🎖️', 'games', 'rare'),
    ('Centurion', 'Play 100 games', '👑', 'games', 'epic'),
    ('Perfect Nine', 'Achieve a perfect 9 hand', '💎', 'achievements', 'legendary'),
    ('Draw Master', 'End a game in a draw', '🤝', 'achievements', 'rare'),
    ('Best Friends <3', 'Have your friend request accepted', '💕', 'social', 'common'),
    ('Social Butterfly', 'Add 5 friends', '🦋', 'social', 'rare'),
    ('Popular', 'Add 10 friends', '⭐', 'social', 'epic')
) AS new_badges(name, description, icon, category, rarity)
WHERE NOT EXISTS (
    SELECT 1 FROM badges WHERE badges.name = new_badges.name
);

-- Indexes for better performance (your originals + new ones)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby_id ON lobby_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_games_lobby_id ON games(lobby_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_user ON game_participants(user_id);

-- XP Level Reference (for development)
-- Level 1: 0 XP (starting level)
-- Level 2: 100 XP  
-- Level 3: 250 XP (100 + 150)
-- Level 4: 500 XP (250 + 250) 
-- Level 5: 875 XP (500 + 375)
-- Level 6: 1437 XP (875 + 562)
-- etc... (each level requires 1.5x more XP than previous increment)