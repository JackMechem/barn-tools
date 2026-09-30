"use client";

import Link from "next/link";
import { BarnLogo } from "@/components/tools";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* Soft accent glow behind the logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[46rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl"
      />

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] text-center sm:px-6 lg:pt-16">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-surface text-accent shadow-lg shadow-black/10 ring-1 ring-foreground/10">
          <BarnLogo className="h-14 w-14" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-5xl font-bold tracking-tight text-accent sm:text-6xl">jackshed</h1>
          <p className="max-w-md text-lg text-muted">Collection of practice tools for musicians</p>
        </div>

        <p className="mt-4 text-sm text-muted">
          <span className="hidden lg:inline">
            Press{" "}
            <kbd className="rounded bg-surface px-2 py-1 font-sans text-xs font-medium text-foreground">
              /
            </kbd>{" "}
            to search practice tools
          </span>
          <span className="lg:hidden">Open the menu to pick a tool</span>
        </p>
      </main>

      <footer className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-6 text-center text-sm text-muted">
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
          href="https://github.com/JackMechem/jackshed.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:underline"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
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
      </footer>
    </div>
  );
}
