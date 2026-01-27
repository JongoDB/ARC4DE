function App() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-6xl">
          ARC
          <span className="text-[var(--color-accent)]">4</span>
          DE
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-secondary)]">
          Automated Remote Control for Distributed Environments
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            System initializing...
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
