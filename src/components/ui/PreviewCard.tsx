import { Card } from "@/components/ui/Card";
import { PlaceholderPanel } from "@/components/ui/PlaceholderPanel";

type PreviewCardProps = {
  title: string;
  description: string;
  variant: "product" | "main" | "dessert";
};

export function PreviewCard({
  title,
  description,
  variant,
}: PreviewCardProps) {
  return (
    <Card padding="none" className="preview-card">
      <PlaceholderPanel label={title} variant={variant} />
      <div className="preview-card-content">
        <h3 className="text-card-heading">{title}</h3>
        <p className="text-supporting">{description}</p>
      </div>
    </Card>
  );
}

