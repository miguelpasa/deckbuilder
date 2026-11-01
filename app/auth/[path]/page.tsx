import { viewPaths } from "@better-auth-ui/core";
import { notFound } from "next/navigation";

import { Auth } from "@/components/auth/auth";
import { Button } from "@/components/ui/button";

const validPaths = Object.values(viewPaths.auth) as string[];

export function generateStaticParams() {
  return validPaths.map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (!validPaths.includes(path)) notFound();

  const showRiot =
    process.env.RSO_ENABLED === "true" &&
    (path === viewPaths.auth.signIn || path === viewPaths.auth.signUp);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <Auth path={path} />
      {showRiot ? (
        <Button variant="outline" disabled className="w-full">
          Sign in with Riot (coming soon)
        </Button>
      ) : null}
    </main>
  );
}
