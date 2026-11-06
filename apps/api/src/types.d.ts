import type { Role } from "@app/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; email: string | null; accessToken: string };
      membership?: { organizationId: string; role: Role; workspaceIds: string[] };
    }
  }
}
