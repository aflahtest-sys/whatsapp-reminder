type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
        🌿
      </div>
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-stone-500">{description}</p>
    </div>
  );
}
