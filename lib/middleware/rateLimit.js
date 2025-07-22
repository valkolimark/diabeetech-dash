'use strict';

const rateLimit = require('express-rate-limit');

function createRateLimiter(env, options = {}) {
  const RATE_LIMIT_ENABLED = env.settings?.RATE_LIMIT_ENABLED === 'true' || env.RATE_LIMIT_ENABLED === 'true';
  
  if (!RATE_LIMIT_ENABLED) {
    // Return a no-op middleware if rate limiting is disabled
    return (req, res, next) => next();
  }

  const RATE_LIMIT_WINDOW_MS = parseInt(env.settings?.RATE_LIMIT_WINDOW_MS || env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
  const RATE_LIMIT_MAX_REQUESTS = parseInt(env.settings?.RATE_LIMIT_MAX_REQUESTS || env.RATE_LIMIT_MAX_REQUESTS || '5');

  const defaultOptions = {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many registration attempts. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000 / 60) + ' minutes'
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
}

module.exports = {
  createRateLimiter
};