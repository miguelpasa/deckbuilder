import Link from "next/link";
import { Suspense } from "react";
import { Library, Search, Users } from "lucide-react";

import { Dashboard, DashboardSkeleton } from "@/components/dashboard/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

const features = [
  {
    icon: Library,
    title: "Track your collection",
    description:
      "Record the Riftbound cards you own and how many copies of each. Your whole collection is on one page.",
  },
  {
    icon: Search,
    title: "See what you're missing",
    description:
      "Compare your collection to featured tournament decklists and see how many cards each deck still needs.",
  },
  {
    icon: Users,
    title: "Borrow from friends",
    description:
      "Share your collection by link or JSON file. The app shows which missing cards your friends could lend you.",
  },
];

const steps = [
  {
    title: "Sign in",
    description: "Use your Google or GitHub account.",
  },
  {
    title: "Add your cards",
    description: "Record the cards you own and the quantities you have.",
  },
  {
    title: "Compare and build",
    description:
      "See which featured decks you can finish, which cards are missing, and which of those friends can lend.",
  },
];

async function HomeContent() {
  const user = await getCurrentUser();
  if (user) return <Dashboard user={user} />;
  return <Landing />;
}

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <HomeContent />
        </Suspense>
      </main>
    </div>
  );
}

function Landing() {
  return (
    <>
        <section className="flex flex-col items-start gap-5 py-14 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Riftbound Deckbuilder
          </h1>
          <p className="max-w-xl text-base leading-7 sm:text-lg text-muted-foreground">
            Track your Riftbound collection, see how close you are to featured
            tournament decklists, and borrow missing cards from friends.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg">
              <Link href="/decks">Browse decks</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/collection">Track your collection</Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="grid gap-4 pb-16 sm:grid-cols-3"
        >
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="gap-4">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription className="leading-6">
                  {description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section
          aria-labelledby="how-it-works-heading"
          className="pb-20"
        >
          <h2
            id="how-it-works-heading"
            className="mb-8 text-xl font-semibold tracking-tight"
          >
            How it works
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="leading-7 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>
    </>
  );
}
