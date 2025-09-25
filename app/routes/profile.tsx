import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import "../styles/profile-style.css";

interface UserStats {
  level: number;
  xp: number;
  xpToNext: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  totalGames: number;
  winRate: number;
  perfectNines: number;
}

interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  earnedAt: string;
}

interface Friend {
  id: number;
  username: string;
  level: number;
  status: string;
  avatarUrl?: string;
}

interface FriendRequest {
  id: number;
  requesterUsername: string;
  requesterId: number;
  createdAt: string;
}

function ProfileContent() {
  const { token } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [statsRes, badgesRes, friendsRes, requestsRes] = await Promise.all([
        fetch('/api/profile/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/profile/badges', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/profile/friends', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/profile/friend-requests', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      
      if (badgesRes.ok) {
        const badgesData = await badgesRes.json();
        setBadges(badgesData);
      }
      
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        setFriends(friendsData);
      }
      
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setFriendRequests(requestsData);
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const sendFriendRequest = async (userId: number) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      
      if (res.ok) {
        alert('Friend request sent!');
        setSearchResults([]);
        setSearchQuery("");
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
    }
  };

  const acceptFriendRequest = async (requestId: number) => {
    try {
      const res = await fetch(`/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchProfileData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const getBadgesByCategory = (category: string) => {
    return badges.filter(badge => badge.category === category);
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: '#9CA3AF',
      rare: '#3B82F6',
      epic: '#8B5CF6',
      legendary: '#F59E0B'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getXPProgress = () => {
    if (!stats) return 0;
    return (stats.xp / (stats.xp + stats.xpToNext)) * 100;
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <div className="avatar">
          <div className="avatar-placeholder">🤠</div>
        </div>
        <div className="user-info">
          <h1>Welcome, Cowpoke!</h1>
          {stats && (
            <>
              <div className="level-info">
                <span className="level">Level {stats.level}</span>
                <div className="xp-bar">
                  <div 
                    className="xp-progress" 
                    style={{ width: `${getXPProgress()}%` }}
                  ></div>
                  <span className="xp-text">{stats.xp} / {stats.xp + stats.xpToNext} XP</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tab-nav">
        <button 
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          📊 Overview
        </button>
        <button 
          className={activeTab === "badges" ? "active" : ""}
          onClick={() => setActiveTab("badges")}
        >
          🏆 Badges
        </button>
        <button 
          className={activeTab === "friends" ? "active" : ""}
          onClick={() => setActiveTab("friends")}
        >
          👥 Friends
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && stats && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>🎮 Games Played</h3>
              <div className="stat-value">{stats.totalGames}</div>
            </div>
            <div className="stat-card">
              <h3>🏆 Win Rate</h3>
              <div className="stat-value">{stats.winRate.toFixed(1)}%</div>
            </div>
            <div className="stat-card">
              <h3>✅ Wins</h3>
              <div className="stat-value">{stats.gamesWon}</div>
            </div>
            <div className="stat-card">
              <h3>❌ Losses</h3>
              <div className="stat-value">{stats.gamesLost}</div>
            </div>
            <div className="stat-card">
              <h3>🤝 Draws</h3>
              <div className="stat-value">{stats.gamesDrawn}</div>
            </div>
            <div className="stat-card">
              <h3>💎 Perfect 9s</h3>
              <div className="stat-value">{stats.perfectNines}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "badges" && (
        <div className="tab-content">
          <div className="badge-categories">
            {['games', 'achievements', 'social'].map(category => (
              <div key={category} className="badge-category">
                <h3>{category.charAt(0).toUpperCase() + category.slice(1)} Badges</h3>
                <div className="badge-grid">
                  {getBadgesByCategory(category).length > 0 ? (
                    getBadgesByCategory(category).map(badge => (
                      <div 
                        key={badge.id} 
                        className="badge-card"
                        style={{ borderColor: getRarityColor(badge.rarity) }}
                      >
                        <div className="badge-icon">{badge.icon}</div>
                        <div className="badge-name">{badge.name}</div>
                        <div className="badge-description">{badge.description}</div>
                        <div className="badge-rarity" style={{ color: getRarityColor(badge.rarity) }}>
                          {badge.rarity}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-badges">No {category} badges earned yet. Start playing to unlock them! 🎯</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "friends" && (
        <div className="tab-content">
          {/* Friend Requests */}
          {friendRequests.length > 0 && (
            <div className="friend-requests">
              <h3>📬 Friend Requests</h3>
              {friendRequests.map(request => (
                <div key={request.id} className="friend-request">
                  <span>{request.requesterUsername} wants to be your friend</span>
                  <button 
                    onClick={() => acceptFriendRequest(request.id)}
                    className="accept-btn"
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search for Friends */}
          <div className="friend-search">
            <h3>🔍 Find Friends</h3>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search for players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
              />
              <button onClick={searchUsers}>Search</button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(user => (
                  <div key={user.id} className="search-result">
                    <span>{user.username} (Level {user.level})</span>
                    <button onClick={() => sendFriendRequest(user.id)}>
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Friends List */}
          <div className="friends-list">
            <h3>👥 Your Friends ({friends.length})</h3>
            <div className="friends-grid">
              {friends.length > 0 ? friends.map(friend => (
                <div key={friend.id} className="friend-card">
                  <div className="friend-avatar">🤠</div>
                  <div className="friend-info">
                    <div className="friend-name">{friend.username}</div>
                    <div className="friend-level">Level {friend.level}</div>
                    <div className={`friend-status ${friend.status}`}>
                      {friend.status === 'online' ? '🟢' : friend.status === 'in-game' ? '🎮' : '⚫'} 
                      {friend.status}
                    </div>
                  </div>
                  <button className="invite-btn">Invite to Game</button>
                </div>
              )) : (
                <div className="no-friends">No friends yet. Search above to add some! 👆</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}