import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
      providerId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    provider?: string;
    providerId?: string;
    email?: string;
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
        if (account && profile) {
            token.provider = account.provider; // "google"
            token.providerId = account.providerAccountId; // stable Google ID
            token.email = profile.email;
        }
        return token;
        },
    async session({ session, token }) {
        session.user.provider = token.provider as string;
        session.user.providerId = token.providerId as string;
        session.user.email = token.email as string;
        return session;
}

  },
});

export { handler as GET, handler as POST };