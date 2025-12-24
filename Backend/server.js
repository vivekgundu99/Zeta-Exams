// server.js - Working Vercel Serverless Configuration
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Initialize dotenv first
dotenv.config();

const app = express();

// ===== CORS MIDDLEWARE (MUST BE FIRST) =====
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://zeta-exams-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// ===== DATABASE CONNECTION =====
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('✅ Using cached database connection');
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  console.log('🔄 Creating new database connection...');
  
  try {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    };

    await mongoose.connect(process.env.MONGODB_URI, opts);
    cachedConnection = mongoose.connection;
    
    console.log(`✅ MongoDB Connected: ${cachedConnection.host}`);
    return cachedConnection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    cachedConnection = null;
    throw error;
  }
}

// Database middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database middleware error:', error);
    return res.status(503).json({
      success: false,
      message: 'Database service temporarily unavailable'
    });
  }
});

// ===== HEALTH CHECK ROUTES (Before other routes) =====
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Zeta Exams API',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working correctly',
    origin: req.headers.origin || 'no-origin',
    method: req.method
  });
});

// ===== ROUTE LOADING =====
let routesLoaded = false;
let loadingPromise = null;

async function loadRoutes() {
  if (routesLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      console.log('🔄 Loading routes...');
      
      const authRoutes = (await import('./routes/auth.routes.js')).default;
      const userRoutes = (await import('./routes/user.routes.js')).default;
      const questionRoutes = (await import('./routes/question.routes.js')).default;
      const subscriptionRoutes = (await import('./routes/subscription.routes.js')).default;
      const adminRoutes = (await import('./routes/admin.routes.js')).default;
      const mockTestRoutes = (await import('./routes/mocktest.routes.js')).default;
      const analyticsRoutes = (await import('./routes/analytics.routes.js')).default;
      const feedbackRoutes = (await import('./routes/feedback.routes.js')).default;
      const giftCodeRoutes = (await import('./routes/giftcode.routes.js')).default;
      const paymentRoutes = (await import('./routes/payment.routes.js')).default;

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

      routesLoaded = true;
      console.log('✅ All routes loaded successfully');
    } catch (error) {
      console.error('❌ Error loading routes:', error);
      routesLoaded = false;
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

// Middleware to ensure routes are loaded before handling API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/') && !routesLoaded) {
    try {
      await loadRoutes();
      // After routes are loaded, Express will automatically match the route
      next();
    } catch (error) {
      console.error('Failed to load routes:', error);
      return res.status(500).json({
        success: false,
        message: 'Server initialization error',
        error: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  } else {
    next();
  }
});

// ===== ERROR HANDLERS =====
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  
  // Don't expose error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({
    success: false,
    message: message
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

// ===== LOCAL DEVELOPMENT SERVER =====
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  
  loadRoutes().then(() => {
    app.listen(PORT, async () => {
      await connectToDatabase();
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// ===== EXPORT FOR VERCEL =====
export default app;