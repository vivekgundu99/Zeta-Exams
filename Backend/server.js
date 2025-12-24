// server.js - Complete Vercel Serverless with CORS Fix
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import questionRoutes from './routes/question.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import adminRoutes from './routes/admin.routes.js';
import mockTestRoutes from './routes/mocktest.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import giftCodeRoutes from './routes/giftcode.routes.js';
import paymentRoutes from './routes/payment.routes.js';

dotenv.config();

const app = express();

// ===== CRITICAL: CORS MUST BE FIRST =====
// Manual CORS handler for Vercel serverless
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // List of allowed origins
  const allowedOrigins = [
    'https://zeta-exams-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];

  // Allow all origins for now (debugging)
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// ===== DATABASE CONNECTION =====
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    console.log('=> Using cached database connection');
    return cachedDb;
  }

  console.log('=> Creating new database connection');
  
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    cachedDb = connection;
    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    cachedDb = null;
    throw error;
  }
}

// Database middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database error:', error);
    res.status(503).json({
      success: false,
      message: 'Database unavailable. Please try again.'
    });
  }
});

// Health checks
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Zeta Exams API',
    cors: 'Enabled',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Test CORS
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS working!',
    origin: req.headers.origin,
    headers: req.headers
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mocktest', mockTestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/giftcode', giftCodeRoutes);
app.use('/api/payment', paymentRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path
  });
});

// Local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    await connectToDatabase();
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export for Vercel
export default app;