import bcrypt from 'bcryptjs';

const ROUNDS = 11;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Password policy — enforced server side (and mirrored by the client schema so
 * users get feedback before submitting).
 */
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireLetter: true,
  requireDigit: true,
} as const;

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_RULES.minLength) {
    issues.push(`Use at least ${PASSWORD_RULES.minLength} characters`);
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    issues.push(`Use at most ${PASSWORD_RULES.maxLength} characters`);
  }
  if (PASSWORD_RULES.requireLetter && !/[a-zA-Z]/.test(password)) {
    issues.push('Include at least one letter');
  }
  if (PASSWORD_RULES.requireDigit && !/\d/.test(password)) {
    issues.push('Include at least one number');
  }
  if (/^\d+$/.test(password)) issues.push('Avoid a password made only of numbers');
  const weak = ['password', '12345678', 'qwerty', 'campusiq', 'admin123', 'letmein'];
  if (weak.some((w) => password.toLowerCase().includes(w))) {
    issues.push('Avoid common words like "password" or "campusiq"');
  }
  return Array.from(new Set(issues));
}
