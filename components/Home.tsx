"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

/** Bar heights for the decorative waveform strip under the hero — hand-picked, not
    `Math.random()`'d at render time, so server and client markup match exactly (a random array
    here would be a real hydration mismatch, the same class of bug `CollapsiblePanel.tsx`'s own
    "always render the chevron" comment warns about elsewhere in this app). */
const WAVEFORM = [
  18, 34, 14, 46, 24, 58, 20, 40, 64, 28, 50, 16, 60, 22, 44, 12, 36, 66, 20,
  52, 26, 42, 14, 38, 56, 18, 48, 24, 32, 16,
];

/** The home page — an actual landing page, not a directory. Every tool still lives in the sidebar
    and the `/` command palette (`components/tools.tsx`'s `NAV_LINKS`) — this page's job is to
    make the case for the site, not index it. Shows "Welcome back, {name}" once signed in —
    `user.name` (only ever set by Google sign-in) if there is one, `user.email` otherwise, since
    every account has one of those but not necessarily both; nothing renders until both
    `useConvexAuth()` and the user query have actually resolved, so a signed-in visitor never sees
    a flash of the signed-out version first. */
export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);
  const greetingName =
    isAuthenticated && user ? (user.name ?? user.email) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-16 px-5 pb-20 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-8 lg:pt-20">
        <section className="flex flex-col gap-6">
          {greetingName && (
            <p className="text-sm font-medium text-accent">
              Welcome back, {greetingName}
            </p>
          )}

          <div aria-hidden className="flex h-12 items-end gap-[3px]">
            {WAVEFORM.map((h, i) => (
              <span
                key={i}
                className="w-1 flex-1 rounded-full bg-accent/40"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          <h1 className="text-6xl font-bold leading-[0.95] tracking-tight text-accent sm:text-7xl">
            sheddex
          </h1>

          <p className="max-w-md text-lg text-muted">
            Level up your playing with advanced, customizable practice tools.
          </p>

          <p className="text-sm text-muted">
            <span className="hidden lg:inline">
              Press{" "}
              <kbd className="rounded bg-surface px-2 py-1 font-sans text-xs font-medium text-foreground">
                /
              </kbd>{" "}
              to search all tools and pages.
            </span>
            <span className="lg:hidden">
              Open the menu any time to jump straight to a tool.
            </span>
          </p>
        </section>

        <section className="border-l-2 border-accent/30 pl-5">
          <p className="text-lg leading-relaxed text-foreground/90">
            Sheddex is built to be a free all-in-one solution to practice tools. My goal is to keep Sheddex distraction free; there will never be ads, popups, or paywalls. That being said, servers are not free, so if you&apos;re feeling generous please consider donating!
          </p>
          <a
            href="https://buymeacoffee.com/jackmechem"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M4 3.5c-.55 0-1 .45-1 1v1c0 3.75 2.6 6.89 6.09 7.73l-.34 1.76H6a.75.75 0 000 1.5h1.44l-.32 1.66A2 2 0 009.08 19.5h5.84a2 2 0 001.96-1.85l.32-1.65H18a.75.75 0 000-1.5h-1.75l-.34-1.76C19.4 12.4 22 9.26 22 5.5v-1c0-.55-.45-1-1-1H4zm14.9 2.5c-.29 2.6-2.12 4.72-4.55 5.42L15 5.5zM9 5.5l.65 5.92C7.22 10.72 5.38 8.6 5.1 6H9z" />
            </svg>
            Buy me a coffee
          </a>
        </section>

        <section>
          <p className="text-sm text-muted">
            Make an account if you want your tune lists and settings to
            follow you to another device, or want a public profile other
            musicians can find on the{" "}
            <Link href="/community" className="text-accent hover:underline font-bold">
              Community
            </Link>
            . Your data will never be sold and never leaves our servers.
          </p>
        </section>
      </main>

      <footer className="flex flex-col items-center gap-2 pb-6 px-2 text-center text-md text-muted">
        <p className="text-accent">
          Built with <span className="text-accent text-lg">♥</span> for musicians, by
          musicians.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>
            Made by{" "}
            <a
              href="https://jackmechem.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              Jack Mechem
            </a>
          </span>
          <span aria-hidden>·</span>
          <a
            href="https://github.com/JackMechem/sheddex.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M12 .5a11.5 11.5 0 00-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0012 .5z" />
            </svg>
            GitHub
          </a>
          <span aria-hidden>·</span>
          <Link
            href="/privacy"
            className="font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/terms"
            className="font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            Terms
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/credits"
            className="font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            Credits
          </Link>
        </div>
      </footer>
    </div>
  );
}
