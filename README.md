# Riftbound Deckbuilder

A Riftbound TCG collection tracker and deck builder. Track the cards you own, and see how complete each of your decks is.

## Features

- Riftbound card collection tracker
- Deck completeness: which cards you still need for each deck

## Stack

- Next.js (App Router, TypeScript)
- Neon Postgres and Neon Auth
- Drizzle ORM
- Tailwind CSS and shadcn/ui
- Deployed on Vercel

## Setup

```bash
npm i
cp .env.example .env   # then fill in the values
neon deploy
npm run db:migrate
npm run dev
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:generate`, `npm run db:seed`.
