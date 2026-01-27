export function ServerListPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
        Servers
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        No servers configured yet.
      </p>
    </div>
  );
}
