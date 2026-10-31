import { Hero } from './hero';
import { Navbar } from './navbar';
import { Faq, Features, Footer, HowItWorks, Integrity, Partners } from './sections';

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Hero />
        <Partners />
        <HowItWorks />
        <Features />
        <Integrity />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
