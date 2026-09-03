const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: isProduction ? process.env.CLIENT_URL : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});
app.use('/api/', limiter);

// Brute-force/enumeration-sensitive auth endpoints get their own stricter,
// always-active limit — unlike the general API limiter above, this one isn't
// skipped outside production, since credential-stuffing/enumeration attempts
// are just as real a risk in a staging environment as in production.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password'], authLimiter);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
