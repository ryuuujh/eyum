import { useId, type ReactNode } from "react";

type PanelProps = {
  title: string;
  description?: string;
  id?: string;
  children?: ReactNode;
};

export function Panel({ title, description, id, children }: PanelProps) {
  const generated_id = useId();
  const heading_id = id ? `${id}_heading` : generated_id;

  return (
    <section id={id} className="panel" aria-labelledby={heading_id}>
      <h2 id={heading_id}>{title}</h2>
      {description && <p className="hint">{description}</p>}
      {children}
    </section>
  );
}
