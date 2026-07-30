import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PocketPaperPersonaliser } from "@/features/personalisation/components/PocketPaperPersonaliser";

export default function Home() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <Section className="hero">
          <Container size="narrow" className="hero-content">
            <h1 className="text-display">
              Visualise your brand
              <span>before you print.</span>
            </h1>
            <p className="text-body hero-description">
              Upload your logo and preview how it may appear on personalised
              DiellArt products before production.
            </p>
            <p className="text-supporting">
              Your file stays private in this browser.
            </p>
          </Container>
        </Section>

        <Section spacing="compact" labelledBy="logo-upload-heading" className="upload-section">
          <PocketPaperPersonaliser />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
