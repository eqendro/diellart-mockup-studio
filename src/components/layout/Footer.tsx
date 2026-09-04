import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="site-footer">
      <Container className="site-footer-inner">
        <p className="footer-brand">DiellART</p>
        <p>© {new Date().getFullYear()} DiellART</p>
        <a href="mailto:info@diellart.com">info@diellart.com</a>
      </Container>
    </footer>
  );
}
