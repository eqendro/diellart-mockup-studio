import { Container } from "@/components/ui/Container";

export function Header() {
  return (
    <header className="site-header">
      <Container className="site-header-inner">
        <a
          href="#"
          aria-label="DiellArt Mockup Studio home"
          className="brand"
        >
          <span className="brand-name">DiellArt</span>
          <span className="brand-product">
            Mockup Studio
          </span>
        </a>
        <span className="text-label header-label">Preview experience</span>
      </Container>
    </header>
  );
}
