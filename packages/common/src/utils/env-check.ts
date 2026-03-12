/**
 * Asserts that the given environment variables are present.
 * Throws a descriptive error if any are missing.
 */
export function assertEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}\n` +
        `Please check your .env file or environment configuration.`
    );
  }
}

/**
 * Gets an environment variable value, throwing if it is not set.
 */
export function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Required environment variable "${key}" is not set.\n` +
        `Please check your .env file or environment configuration.`
    );
  }
  return value;
}
