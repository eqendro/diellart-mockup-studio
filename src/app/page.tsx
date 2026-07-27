import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PreviewCard } from "@/components/ui/PreviewCard";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { UploadDropzonePreview } from "@/components/ui/UploadDropzonePreview";

const previews = [
  {
    title: "Product View",
    description: "A focused look at your personalised Pocket Paper design.",
    variant: "product" as const,
  },
  {
    title: "Main Dish Setting",
    description: "See your branding presented in a refined table setting.",
    variant: "main" as const,
  },
  {
    title: "Dessert Setting",
    description: "Preview the details in a lighter finishing-course scene.",
    variant: "dessert" as const,
  },
];

export default function Home() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <Section className="hero">
          <Container size="narrow" className="hero-content">
            <Badge variant="accent">
              Pocket Paper — First product coming soon
            </Badge>
            <h1 className="text-display">
              Visualise your brand
              <span>before you print.</span>
            </h1>
            <p className="text-body hero-description">
              Soon, you&apos;ll be able to upload your logo and preview it on
              personalised DiellArt products before moving to production.
            </p>
            <Button
              type="button"
              size="large"
              disabled
              aria-describedby="hero-upload-status"
            >
              Upload Logo
            </Button>
            <p id="hero-upload-status" className="text-supporting">
              Uploads will be available in a future release.
            </p>
          </Container>
        </Section>

        <Container className="upload-preview-wrap">
          <UploadDropzonePreview />
        </Container>

        <Section labelledBy="preview-heading" className="preview-section">
          <Container>
            <SectionHeader
              eyebrow="Three perspectives"
              heading="Your product, thoughtfully presented."
              headingId="preview-heading"
            />
            <div className="preview-grid">
              {previews.map((preview) => (
                <PreviewCard key={preview.title} {...preview} />
              ))}
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

