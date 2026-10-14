export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8 space-y-2">
      <h1 className="font-[family-name:var(--font-source-serif)] text-3xl tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
    </header>
  );
}
