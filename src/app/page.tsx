import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { PreviewCard } from "@/components/ui/PreviewCard";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LogoUpload } from "@/features/upload/components/LogoUpload";

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
            <a
              href="#logo-upload"
              className="button button-primary button-large hero-cta"
            >
              Upload Logo
            </a>
            <p className="text-supporting">
              Your file stays private in this browser.
            </p>
          </Container>
        </Section>

        <Section spacing="compact" labelledBy="logo-upload-heading" className="upload-section">
          <Container>
            <LogoUpload />
          </Container>
        </Section>

        <Section labelledBy="preview-heading" className="preview-section">
          <Container>
            <SectionHeader
              eyebrow="Three perspectives"
              heading="Your product, thoughtfully presented."
              description="Mockup generation is not active yet. These views will use your selected logo in a future stage."
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
