// server.js - Fixed Version with Manual CORS Headers
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';

dotenv.config();

const app = express();

// ===== MANUAL CORS HEADERS (BEFORE CORS MIDDLEWARE) =====
app.use((req, res, next) => {
  // Set CORS headers manually
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ===== CORS MIDDLEWARE (BACKUP) =====
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== BASIC ROUTES =====
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Zeta Exams API', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api', (req, res) => {
  res.json({ status: 'OK', message: 'API Ready' });
});

// ===== INITIALIZATION STATE =====
let initializationPromise = null;
let isInitialized = false;
let routeHandlers = null;

// ===== INITIALIZE FUNCTION =====
async function initialize() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('🔄 Starting initialization...');

      // 1. Connect to database
      await connectDB();
      console.log('✅ Database connected');

      // 2. Load all routes
      console.log('📦 Loading routes...');
      
      const [
        authModule,
        userModule,
        questionModule,
        subscriptionModule,
        adminModule,
        mocktestModule,
        analyticsModule,
        feedbackModule,
        giftcodeModule,
        paymentModule
      ] = await Promise.all([
        import('./routes/auth.routes.js'),
        import('./routes/user.routes.js'),
        import('./routes/question.routes.js'),
        import('./routes/subscription.routes.js'),
        import('./routes/admin.routes.js'),
        import('./routes/mocktest.routes.js'),
        import('./routes/analytics.routes.js'),
        import('./routes/feedback.routes.js'),
        import('./routes/giftcode.routes.js'),
        import('./routes/payment.routes.js')
      ]);

      routeHandlers = {
        auth: authModule.default,
        user: userModule.default,
        question: questionModule.default,
        subscription: subscriptionModule.default,
        admin: adminModule.default,
        mocktest: mocktestModule.default,
        analytics: analyticsModule.default,
        feedback: feedbackModule.default,
        giftcode: giftcodeModule.default,
        payment: paymentModule.default
      };

      console.log('✅ All routes loaded');

      isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      console.error('Error stack:', error.stack);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

// ===== HEALTH CHECK (WITH AUTO-INIT) =====
app.get('/api/health', async (req, res) => {
  try {
    // Try to initialize if not already done
    if (!isInitialized) {
      console.log('Health check triggering initialization...');
      await initialize();
    }
    
    res.json({
      success: true,
      status: 'healthy',
      db: 'connected',
      routesLoaded: isInitialized,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'initializing',
      db: 'unknown',
      routesLoaded: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== INITIALIZATION MIDDLEWARE =====
const ensureInitialized = async (req, res, next) => {
  if (isInitialized) {
    return next();
  }

  try {
    await initialize();
    next();
  } catch (error) {
    console.error('Initialization error:', error);
    res.status(503).json({
      success: false,
      message: 'Service is initializing. Please try again in a moment.',
      error: error.message
    });
  }
};

// ===== MOUNT ROUTES WITH INITIALIZATION =====
app.use('/api/auth', ensureInitialized, (req, res, next) => {
  routeHandlers.auth(req, res, next);
});

app.use('/api/user', ensureInitialized, (req, res, next) => {
  routeHandlers.user(req, res, next);
});

app.use('/api/questions', ensureInitialized, (req, res, next) => {
  routeHandlers.question(req, res, next);
});

app.use('/api/subscription', ensureInitialized, (req, res, next) => {
  routeHandlers.subscription(req, res, next);
});

app.use('/api/admin', ensureInitialized, (req, res, next) => {
  routeHandlers.admin(req, res, next);
});

app.use('/api/mocktest', ensureInitialized, (req, res, next) => {
  routeHandlers.mocktest(req, res, next);
});

app.use('/api/analytics', ensureInitialized, (req, res, next) => {
  routeHandlers.analytics(req, res, next);
});

app.use('/api/feedback', ensureInitialized, (req, res, next) => {
  routeHandlers.feedback(req, res, next);
});

app.use('/api/giftcode', ensureInitialized, (req, res, next) => {
  routeHandlers.giftcode(req, res, next);
});

app.use('/api/payment', ensureInitialized, (req, res, next) => {
  routeHandlers.payment(req, res, next);
});

// ===== ERROR HANDLERS =====
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
});

// ===== SERVER STARTUP =====
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  initialize()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      });
    })
    .catch(error => {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    });
} else {
  console.log('🔄 Running in production mode - will initialize on first request');
}

export default app;