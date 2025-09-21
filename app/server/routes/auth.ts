import express from 'express';
import { AuthService } from '../services/authService.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await AuthService.register(username, password, email);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.status(201).json({
      message: 'User registered successfully',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    console.error('Register route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await AuthService.login(username, password);

    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }

    res.json({
      message: 'Login successful',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;