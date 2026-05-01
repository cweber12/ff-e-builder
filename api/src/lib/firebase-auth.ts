import type { Env } from '../types';

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ISSUER_BASE = 'https://securetoken.google.com/';

interface JWK {
  kty: string;
  alg: string;
  use: string;
  kid: string;
  n: string;
  e: string;
}

interface TokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
}

function b64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function parseJwtPart<T>(b64url: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBuffer(b64url))) as T;
}

async function fetchMatchingJwk(kid: string): Promise<JWK> {
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const raw: unknown = JSON.parse(await res.text());
  const { keys } = raw as { keys: JWK[] };
  const key = keys.find((k) => k.kid === kid);
  if (!key) throw new Error(`No public key found for kid=${kid}`);
  return key;
}

/**
 * Verifies a Firebase ID token using the Web Crypto API.
 * Replaces firebase-admin to remain compatible with the Cloudflare Workers
 * edge runtime, which does not support all Node.js APIs that firebase-admin
 * requires.
 */
export async function verifyFirebaseToken(token: string, env: Env): Promise<{ uid: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const { kid, alg } = parseJwtPart<{ kid: string; alg: string }>(headerB64);
  if (alg !== 'RS256') throw new Error(`Unexpected algorithm: ${alg}`);

  const claims = parseJwtPart<TokenClaims>(payloadB64);
  const now = Math.floor(Date.now() / 1000);
  const projectId = env.FIREBASE_PROJECT_ID;

  if (claims.iss !== `${ISSUER_BASE}${projectId}`) throw new Error('Invalid issuer');
  if (claims.aud !== projectId) throw new Error('Invalid audience');
  if (claims.exp <= now) throw new Error('Token expired');
  if (claims.iat > now + 60) throw new Error('Token issued in the future');
  if (!claims.sub) throw new Error('Missing sub claim');

  const jwk = await fetchMatchingJwk(kid);
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    b64urlToBuffer(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );

  if (!valid) throw new Error('Invalid signature');
  return { uid: claims.sub };
}
