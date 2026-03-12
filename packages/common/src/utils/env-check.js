"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertEnvVars = assertEnvVars;
exports.requireEnvVar = requireEnvVar;
/**
 * Asserts that the given environment variables are present.
 * Throws a descriptive error if any are missing.
 */
function assertEnvVars(requiredVars) {
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}\n` +
            `Please check your .env file or environment configuration.`);
    }
}
/**
 * Gets an environment variable value, throwing if it is not set.
 */
function requireEnvVar(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable "${key}" is not set.\n` +
            `Please check your .env file or environment configuration.`);
    }
    return value;
}
//# sourceMappingURL=env-check.js.map