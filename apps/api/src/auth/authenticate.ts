import { uuidSchema } from "@app/shared";
import type { RequestHandler } from "express";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Config } from "../config";
import { DomainError, asyncRoute, authInvalid, authRequired } from "../http";

export interface AuthUser {
  userId: string;
  email: string | null;
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthUser>;
}

interface VerifierOptions {
  issuer: string;
  audience?: string;
}

const ALLOWED_ALGORITHMS = ["ES256", "RS256", "EdDSA"];

export function createJwtVerifier(getKey: JWTVerifyGetKey, options: VerifierOptions): TokenVerifier {
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, getKey, {
          issuer: options.issuer,
          audience: options.audience ?? "authenticated",
          algorithms: ALLOWED_ALGORITHMS,
          clockTolerance: 5,
        });
        const sub = uuidSchema.safeParse(payload.sub);
        if (!sub.success) throw authInvalid();
        return { userId: sub.data, email: typeof payload.email === "string" ? payload.email : null };
      } catch (err) {
        if (err instanceof DomainError) throw err;
        if (err instanceof joseErrors.JWKSTimeout) {
          throw new DomainError(503, "AUTH_UNAVAILABLE", "Serviço de autenticação indisponível.");
        }
        throw authInvalid();
      }
    },
  };
}

export function createRemoteJwtVerifier(config: Pick<Config, "jwksUrl" | "jwtIssuer">): TokenVerifier {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
  });
  return createJwtVerifier(jwks, { issuer: config.jwtIssuer });
}

export function authenticate(verifier: TokenVerifier): RequestHandler {
  return asyncRoute(async (req, _res, next) => {
    const [scheme, token] = (req.header("authorization") ?? "").split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) throw authRequired();
    req.auth = { ...(await verifier.verify(token)), accessToken: token };
    next();
  });
}
