/**
 * Short alphanumeric request-id generator
 * Uses crypto.randomUUID() and trims to 8 characters
 */

import { randomUUID } from 'crypto';

/**
 * Generate a short (8-char) alphanumeric request identifier.
 */
export function generateRequestId(): string {
  // randomUUID returns a 36-char UUID with hyphens; strip hyphens and take 8 chars
  return randomUUID().replace(/-/g, '').slice(0, 8);
}
