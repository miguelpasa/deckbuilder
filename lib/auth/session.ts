import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

/**
 * Reads the session from cookies (a dynamic API). Under `cacheComponents`,
 * call it from a component rendered inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    image: user.image ?? null,
  };
}

/** For pages: redirects to the sign-in view when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

/** For route handlers: returns `{ user }` or `{ response }` (a 401). */
export async function requireUserForApi(): Promise<
  { user: CurrentUser; response?: undefined } | { user?: undefined; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

export function isAdmin(user: Pick<CurrentUser, "email"> | null | undefined): boolean {
  if (!user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}
