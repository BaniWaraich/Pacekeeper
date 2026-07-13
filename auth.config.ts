import type { NextAuthConfig } from "next-auth";

// Paths reachable without a session. Everything else the proxy matcher
// covers requires auth (tech doc §7: all (app) routes protected).
const PUBLIC_PATHS = ["/", "/login"];

// Prisma/bcryptjs-free config, safe to bundle into proxy.ts.
// The credentials provider lives in auth.ts.
export const authConfig = {
  // The app always runs behind a trusted proxy (Vercel) or localhost;
  // without this, `next start` locally rejects every auth request
  // with UntrustedHost.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
