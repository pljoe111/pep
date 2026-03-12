import { cleanEnv, str, num, bool, host } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'production', 'test'],
    default: 'development',
  }),
  PORT: num({ default: 3000 }),
  HOST: host({ default: '0.0.0.0' }),
  DATABASE_URL: str(),
  CORS_ORIGIN: str({ default: 'http://localhost:5173' }),
  ENABLE_SWAGGER: bool({ default: true }),
});
