type SectionHeaderProps = {
  heading: string;
  description?: string;
  eyebrow?: string;
  align?: "left" | "center";
  headingId?: string;
};

export function SectionHeader({
  heading,
  description,
  eyebrow,
  align = "left",
  headingId,
}: SectionHeaderProps) {
  return (
    <header className={`section-header section-header-${align}`}>
      {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
      <h2 id={headingId} className="text-section-heading">
        {heading}
      </h2>
      {description ? <p className="text-body">{description}</p> : null}
    </header>
  );
}

