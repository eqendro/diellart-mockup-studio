import Image from "next/image";
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
          <Image
            src="/brand/diellart-logo.png"
            alt="DiellART"
            width={3000}
            height={2674}
            className="brand-logo"
            priority
          />
          <span className="brand-product">
            Mockup Studio
          </span>
        </a>
        <a className="text-label header-label" href="#logo-upload">
          Studio digjitale
        </a>
      </Container>
    </header>
  );
}
