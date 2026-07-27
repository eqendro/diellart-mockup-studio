type PlaceholderPanelProps = {
  label: string;
  variant?: "product" | "main" | "dessert";
};

export function PlaceholderPanel({
  label,
  variant = "product",
}: PlaceholderPanelProps) {
  return (
    <div
      role="img"
      aria-label={`${label} placeholder preview`}
      className={`placeholder-panel placeholder-${variant}`}
    >
      <span className="placeholder-object" aria-hidden="true" />
      <span className="placeholder-label" aria-hidden="true">
        Preview
      </span>
    </div>
  );
}

