// server.js - Serverless-Optimized Entry Point
import express from 'express';
import cors from 'cors';
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

// CORS Configuration
const allowedOrigins = [
  'https://zeta-exams-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5500'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== SERVERLESS DATABASE CONNECTION =====
// Cached connection for serverless functions
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    console.log('=> Using existing database connection');
    return cachedDb;
  }

  console.log('=> Creating new database connection');
  
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      // Serverless-optimized settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10, // Limit connection pool for serverless
      minPoolSize: 1,
      maxIdleTimeMS: 10000, // Close idle connections quickly
      // Remove deprecated options
      useNewUrlParser: true,
      useUnifiedTopology: true,
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

// Middleware to ensure DB connection before each request
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection failed. Please try again.'
    });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Zeta Exams API is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Routes
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

// Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    await connectToDatabase();
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel (serverless)
export default app;