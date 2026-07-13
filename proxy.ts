import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Imports only auth.config.ts so Prisma and bcryptjs stay out of the
// proxy bundle. Unauthenticated page requests are redirected to /login
// by the authorized callback + pages.signIn.
export default NextAuth(authConfig).auth;

export const config = {
  // API routes handle their own 401s via requireUser (tech doc §6);
  // everything else except Next internals and static files needs a session.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
