export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <p className="text-xs font-medium text-fg">{title}</p>
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}
