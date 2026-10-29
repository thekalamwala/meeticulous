/**
 * Structured security-aware logger
 * Uses Winston — never logs passwords, tokens, or PII beyond what's needed for audit
 */
const winston = require('winston');
const path = require('path');

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

// Dev console: never let an object-valued message render as "[object Object]".
// winston's built-in simple() coerces info.message with template interpolation,
// so a call like logger.info(someObject) collapses to "[object Object]". This
// printf JSON-stringifies object messages and any extra metadata instead, so the
// real content is always visible. Prod uses json() below and is unaffected.
const stringify = (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
const devFormat = printf((info) => {
  const { level, message, stack, timestamp: ts, ...rest } = info;
  // Strip winston-internal symbol keys; keep only real metadata.
  const meta = Object.keys(rest).reduce((acc, k) => {
    if (typeof k === 'string' && k !== 'splat') acc[k] = rest[k];
    return acc;
  }, {});
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${level}: ${stack || stringify(message) || ''}${metaStr}`;
});

// Mask sensitive fields before logging
const maskSensitive = winston.format((info) => {
  const SENSITIVE = ['password', 'token', 'secret', 'otp', 'google_access_token',
    'google_refresh_token', 'razorpay_signature', 'RAZORPAY_KEY_SECRET'];
  if (info.body) {
    const safeBody = { ...info.body };
    SENSITIVE.forEach(k => { if (safeBody[k]) safeBody[k] = '[REDACTED]'; });
    info.body = safeBody;
  }
  return info;
})();

const logger = winston.createLogger({
  level: isProd ? 'warn' : 'info',
  format: combine(
    errors({ stack: true }),
    maskSensitive,
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    // Console (always)
    new winston.transports.Console({
      format: isProd ? combine(timestamp(), json()) : combine(colorize(), devFormat),
    }),
    // File transport in production
    ...(isProd ? [
      new winston.transports.File({
        filename: path.join(__dirname, '../logs/error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(__dirname, '../logs/security.log'),
        level: 'warn',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 10,
      }),
    ] : []),
  ],
});

// Security-specific event logger
const securityLog = (event, data = {}) => {
  logger.warn({ event, ...data, timestamp: new Date().toISOString() });
};

// Audit log for business events
const auditLog = (action, userId, data = {}) => {
  logger.info({ type: 'AUDIT', action, userId, ...data, timestamp: new Date().toISOString() });
};

// Request logging middleware (no body logging in prod for PII)
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method, url: req.originalUrl,
      status: res.statusCode, duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    };
    if (res.statusCode >= 400) logger.warn({ type: 'REQUEST', ...logData });
    else logger.info({ type: 'REQUEST', ...logData });
  });
  next();
};

module.exports = { logger, securityLog, auditLog, requestLogger };
