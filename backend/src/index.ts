// MUST be first: loads .env into process.env *before* any route module is
// imported. Route modules (authRoutes, authMiddleware, etc.) capture
// JWT_SECRET into module-top constants; if dotenv loads after them, those
// constants fall back to their hardcoded defaults — and because authRoutes
// and authMiddleware have *different* defaults, every signed token fails
// verification and every authenticated request 401s. See fix history for
// the quiz-history "session expired" bug.
import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fileUpload from 'express-fileupload';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import quizRoutes from './routes/quizRoutes';
import quizItemRoutes from './routes/quizItemRoutes';
import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import questionBagV2Routes from './routes/questionBagV2Routes';
import questionBagV3Routes from './routes/questionBagV3Routes';
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';
import leadRoutes from './routes/leadRoutes';
import supportRoutes from './routes/supportRoutes';
import myQuestionsRoutes from './routes/myQuestionsRoutes';
import accountRoutes from './routes/accountRoutes';
import { assertProductionSecrets } from './config/secrets';

// Fail fast in production if any required secret is missing or still set
// to a dev default. No-op in non-production.
assertProductionSecrets();

const app = express();
const PORT = process.env.PORT || 5006;

// Security headers. CSP is intentionally disabled here — this server only
// returns JSON; CSP belongs on the asset host (Caddy/Cloudflare in prod,
// CRA in dev). crossOriginResourcePolicy is relaxed so the CRA dev server
// on a different port can consume the API.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Middleware
app.use(cors({
  // Allow any localhost port in development (CRA picks the next free port,
  // so 3000/3001/3002/… all need to work). Production should narrow this.
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser clients (curl, server-to-server)
    if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Required so authRoutes can read req.cookies.refreshToken on /auth/refresh-token
// and /auth/logout. Without this, the refresh cookie set at login is invisible
// to the server and the silent-refresh flow falls back to forced re-login.
app.use(cookieParser());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check — used by uptime monitors. No auth, no rate limit.
app.get('/api/health', (_req, res) => {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const mongoState = states[mongoose.connection.readyState] ?? 'unknown';
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ ok, mongo: mongoState });
});

// Stricter rate limiter on auth + payments. In-memory bucket is fine for
// a single-server v1; revisit when we scale horizontally.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // 30 requests per IP per window across /api/auth/*
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, try again later.' },
});
const paymentsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests, try again later.' },
});
// Lead-capture form is unauthenticated — keep the bucket tight to discourage
// abuse / scripted spam from a single IP.
const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                  // 10 access requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many access requests, please try again later.' },
});
// Support form is unauthenticated — same shape as leads but a slightly
// looser cap since registered users may legitimately raise multiple tickets.
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many support requests, please try again later.' },
});

// Routes
app.use('/api/quiz', quizRoutes);
app.use('/api/quiz-items', quizItemRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/question-bag-v2', questionBagV2Routes);
app.use('/api/question-bag-v3', questionBagV3Routes);
app.use('/api/payments', paymentsLimiter, paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leads', leadsLimiter, leadRoutes);
app.use('/api/support', supportLimiter, supportRoutes);
app.use('/api/my-questions', myQuestionsRoutes);
app.use('/api/account', accountRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gmat-quiz')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
