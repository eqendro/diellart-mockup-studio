import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PocketPaperPersonaliser } from "@/features/personalisation/components/PocketPaperPersonaliser";
import { ContactSection } from "@/features/quote-request/ContactSection";

export default function Home() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <PocketPaperPersonaliser />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
