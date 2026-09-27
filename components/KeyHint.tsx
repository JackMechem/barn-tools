function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded bg-surface px-1.5 py-0.5 font-sans text-[0.7rem] font-medium text-foreground">
      {children}
    </kbd>
  );
}

/** Small keyboard-shortcut hint shown under a page's main button. */
export default function KeyHint({ children }: { children: React.ReactNode }) {
  return <p className="-mt-4 text-xs text-muted">{children}</p>;
}

KeyHint.Key = Kbd;
