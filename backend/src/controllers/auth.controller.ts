import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_USERNAME    = process.env.ADMIN_USERNAME    || 'admin';
const ADMIN_PASS_HASH   = process.env.ADMIN_PASS_HASH   || '';   // bcrypt hash of the password
const ADMIN_PASS_PLAIN  = process.env.ADMIN_PASSWORD    || 'secret123'; // fallback for local dev only
const JWT_SECRET        = process.env.JWT_SECRET        || 'fallback-super-secret-key';

// ---------------------------------------------------------------------------
// How credentials are validated:
//
//  Production  → set ADMIN_PASS_HASH to a bcrypt hash (e.g. generate once with
//                `node -e "console.log(require('bcryptjs').hashSync('yourpassword',12))"`)
//                and leave ADMIN_PASSWORD unset.
//
//  Local dev   → set ADMIN_PASSWORD in .env; ADMIN_PASS_HASH is empty so we
//                fall back to a direct comparison (convenient, never in prod).
// ---------------------------------------------------------------------------
async function isPasswordValid(candidate: string): Promise<boolean> {
  if (ADMIN_PASS_HASH) {
    // Production path: constant-time bcrypt comparison
    return bcrypt.compare(candidate, ADMIN_PASS_HASH);
  }
  // Dev-only fallback: plain string comparison
  return candidate === ADMIN_PASS_PLAIN;
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'username and password are required' } });
      return;
    }

    const usernameMatch = username === ADMIN_USERNAME;
    const passwordMatch = await isPasswordValid(password);

    // Check both fields together so we don't leak which one was wrong
    if (usernameMatch && passwordMatch) {
      const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      res.status(200).json({ token });
    } else {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }
  } catch (error) {
    next(error);
  }
};
