import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hashing lives behind this interface so the algorithm can be swapped
 * (e.g. to bcrypt) without touching call sites, in case the argon2 native
 * binding ever fails to build for a target platform.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
