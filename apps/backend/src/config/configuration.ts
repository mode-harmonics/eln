import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  // Database — prefer DATABASE_URL, fall back to individual vars
  DATABASE_URL: Joi.string().optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().default('eln'),
  DB_PASSWORD: Joi.string().default('eln'),
  DB_NAME: Joi.string().default('eln'),
  DB_SSL: Joi.boolean().default(false),

  // JWT
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // File storage
  UPLOAD_DIR: Joi.string().default('./uploads'),
});

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'eln',
    password: process.env.DB_PASSWORD || 'eln',
    database: process.env.DB_NAME || 'eln',
    ssl: (process.env.DB_SSL || 'false').toLowerCase() === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
});
