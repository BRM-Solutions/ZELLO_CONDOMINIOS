import { rolesFor, type Permission, type Role } from "@app/shared";
import type { RequestHandler } from "express";
import { forbidden, notFound } from "../http";

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.membership) {
      next(notFound());
      return;
    }
    next(roles.includes(req.membership.role) ? undefined : forbidden());
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return requireRole(...rolesFor(permission));
}
