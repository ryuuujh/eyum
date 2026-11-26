type PageHeadingProps = {
  title: string;
  description?: string;
};

export function PageHeading({ title, description }: PageHeadingProps) {
  return (
    <header className="page_heading">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
