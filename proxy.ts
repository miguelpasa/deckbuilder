import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
  // /api/decks and /api/share do their own visibility checks (private decks, PRIVATE collections).
  publicRoutes: ["/", "/cards", "/decks", "/share", "/legal", "/riot.txt", "/api/cron", "/api/decks", "/api/share"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
