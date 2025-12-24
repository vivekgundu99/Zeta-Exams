// server.js - Fixed Routes Loading
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';

dotenv.config();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
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

// ===== DATABASE CONNECTION =====
let dbConnected = false;

const initDB = async () => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
    }
  }
};

// ===== DYNAMIC ROUTE LOADING =====
let routesLoaded = false;
let routeHandlers = {};

const loadRoutes = async () => {
  if (routesLoaded) return routeHandlers;
  
  try {
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

    routesLoaded = true;
    console.log('✅ All routes loaded successfully');
    return routeHandlers;
  } catch (error) {
    console.error('❌ Route loading failed:', error);
    throw error;
  }
};

// ===== HEALTH CHECK =====
app.get('/api/health', async (req, res) => {
  await initDB();
  
  res.json({
    success: true,
    status: 'healthy',
    db: dbConnected ? 'connected' : 'disconnected',
    routesLoaded,
    timestamp: new Date().toISOString()
  });
});

// ===== MIDDLEWARE TO ENSURE ROUTES ARE LOADED =====
const ensureRoutesLoaded = async (req, res, next) => {
  await initDB();
  
  if (!routesLoaded) {
    try {
      await loadRoutes();
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'Service initializing. Please try again in a moment.'
      });
    }
  }
  next();
};

// ===== MOUNT ROUTES =====
app.use('/api/auth', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.auth(req, res, next);
});

app.use('/api/user', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.user(req, res, next);
});

app.use('/api/questions', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.question(req, res, next);
});

app.use('/api/subscription', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.subscription(req, res, next);
});

app.use('/api/admin', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.admin(req, res, next);
});

app.use('/api/mocktest', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.mocktest(req, res, next);
});

app.use('/api/analytics', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.analytics(req, res, next);
});

app.use('/api/feedback', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.feedback(req, res, next);
});

app.use('/api/giftcode', ensureRoutesLoaded, (req, res, next) => {
  routeHandlers.giftcode(req, res, next);
});

app.use('/api/payment', ensureRoutesLoaded, (req, res, next) => {
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
  // Local development
  (async () => {
    try {
      await initDB();
      await loadRoutes();
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  })();
}

// ===== VERCEL EXPORT =====
export default app;