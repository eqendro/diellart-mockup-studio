import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="site-footer">
      <Container className="site-footer-inner">
        <p className="footer-brand">DiellArt</p>
        <p>© {new Date().getFullYear()} DiellArt. All rights reserved.</p>
      </Container>
    </footer>
  );
}
