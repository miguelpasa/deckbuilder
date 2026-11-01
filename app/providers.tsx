"use client";

import { getSafeRedirectTo } from "@better-auth-ui/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/client";

const githubEnabled = process.env.NEXT_PUBLIC_AUTH_GITHUB === "true";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        authClient={authClient}
        emailAndPassword={{ enabled: true, requireEmailVerification: false }}
        socialProviders={githubEnabled ? ["google", "github"] : ["google"]}
        navigate={({ to, replace }) => {
          const path = getSafeRedirectTo(to, window.location.origin);
          const target = path.startsWith("//") ? "/" : path;
          if (replace) router.replace(target);
          else router.push(target);
        }}
        Link={Link}
        redirectTo="/collection"
      >
        <TooltipProvider>{children}</TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
