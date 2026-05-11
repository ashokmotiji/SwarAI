export function ReadmePreviewTopBar({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="text-sm font-semibold tracking-tight sm:text-base">{title}</h1>
      <div
        className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary"
        aria-hidden
      >
        S
      </div>
    </header>
  );
}
