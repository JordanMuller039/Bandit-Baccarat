# Bandit Baccarat

A multiplayer card game built with React, Node.js, TypeScript, and Phaser.

## Features

- Real-time multiplayer lobbies
- PostgreSQL database with user authentication
- JWT-based authentication
- WebSocket communication for live updates
- Modern React frontend with TypeScript

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Socket.IO Client
- **Backend**: Node.js, Express, TypeScript, Socket.IO
- **Database**: PostgreSQL
- **Game Engine**: Phaser 3
- **Authentication**: JWT, bcrypt

## Setup
1. Install dependencies:
```bash
   npm install

2. Set up PostgreSQL and create database bandit_baccarat

3. Create .env file with your database credentials:
VITE_SERVER_URL=http://localhost:3001
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=bandit_baccarat
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your-secret-key
   PORT=3001
   CORS_ORIGIN=http://localhost:5173

4. Run Development Server
```bash
    npm run dev

## Project Structure
├── src/                 # Frontend React app
├── app/server/          # Backend Node.js server
├── public/              # Static assets
└── package.json

## Development
Frontend runs on http://localhost:5173
Backend runs on http://localhost:3001
Database runs on localhost:5432

