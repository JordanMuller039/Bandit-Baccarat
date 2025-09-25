import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { initializeDatabase } from './database/init.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js'; // Make sure this line exists
import { setupSocketHandlers } from './socket/handlers.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Routes - ORDER MATTERS!
app.use('/api/auth', authRoutes);
app.use('/api', profileRoutes); 


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO - This should be here
setupSocketHandlers(io);

// Debugging
io.on('connection', (socket) => {
  console.log('🔵 Raw socket connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔴 Raw socket disconnected:', socket.id);
  });
});


// Start server
async function startServer() {
  try {
    await initializeDatabase();
        
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();