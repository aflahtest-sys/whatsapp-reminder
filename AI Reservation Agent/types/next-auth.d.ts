import { DefaultSession } from "next-auth";
import "next-auth/jwt";

type AppRole = "PLATFORM_ADMIN" | "ORG_OWNER" | "ORG_STAFF";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      organizationId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: AppRole;
    organizationId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    organizationId?: string | null;
  }
}
