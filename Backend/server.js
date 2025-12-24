// server.js - Routes Load with Promise
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ===== DATABASE =====
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000
    });
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB error:', error.message);
  }
};

// ===== BASIC ROUTES =====
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Zeta Exams API', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ status: 'OK', message: 'API Ready' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy', 
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    routesLoaded 
  });
});

// ===== LOAD ROUTES =====
const routes = {};
let routesLoaded = false;

const loadRoutesPromise = Promise.all([
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
]).then(([auth, user, question, subscription, admin, mocktest, analytics, feedback, giftcode, payment]) => {
  routes.auth = auth.default;
  routes.user = user.default;
  routes.question = question.default;
  routes.subscription = subscription.default;
  routes.admin = admin.default;
  routes.mocktest = mocktest.default;
  routes.analytics = analytics.default;
  routes.feedback = feedback.default;
  routes.giftcode = giftcode.default;
  routes.payment = payment.default;
  routesLoaded = true;
  console.log('✅ All routes loaded');
}).catch(error => {
  console.error('❌ Routes loading failed:', error);
});

// ===== ROUTE MIDDLEWARE =====
const waitForRoutes = async (req, res, next) => {
  if (routesLoaded) {
    return next();
  }
  
  try {
    await Promise.race([
      loadRoutesPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);
    next();
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service initializing, please retry in 5 seconds' });
  }
};

const dbAndRoutesMiddleware = async (req, res, next) => {
  await connectDB();
  await waitForRoutes(req, res, next);
};

// ===== MOUNT ROUTES =====
app.use('/api/auth', dbAndRoutesMiddleware, (req, res, next) => {
  routes.auth(req, res, next);
});

app.use('/api/user', dbAndRoutesMiddleware, (req, res, next) => {
  routes.user(req, res, next);
});

app.use('/api/questions', dbAndRoutesMiddleware, (req, res, next) => {
  routes.question(req, res, next);
});

app.use('/api/subscription', dbAndRoutesMiddleware, (req, res, next) => {
  routes.subscription(req, res, next);
});

app.use('/api/admin', dbAndRoutesMiddleware, (req, res, next) => {
  routes.admin(req, res, next);
});

app.use('/api/mocktest', dbAndRoutesMiddleware, (req, res, next) => {
  routes.mocktest(req, res, next);
});

app.use('/api/analytics', dbAndRoutesMiddleware, (req, res, next) => {
  routes.analytics(req, res, next);
});

app.use('/api/feedback', dbAndRoutesMiddleware, (req, res, next) => {
  routes.feedback(req, res, next);
});

app.use('/api/giftcode', dbAndRoutesMiddleware, (req, res, next) => {
  routes.giftcode(req, res, next);
});

app.use('/api/payment', dbAndRoutesMiddleware, (req, res, next) => {
  routes.payment(req, res, next);
});

// ===== ERROR HANDLERS =====
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

// ===== LOCAL DEV =====
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  loadRoutesPromise.then(() => connectDB()).then(() => {
    app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
  });
}

export default app;