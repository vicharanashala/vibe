import { Link } from '@tanstack/react-router';
import {
  BarChart3Icon,
  BookmarkIcon,
  Code2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import OrbBackground from '@/components/orb-background';
import { PartnerLogos } from '@/components/partner-logos';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  CONTACT_EMAIL,
  DOCS_HREF,
  FAQS,
  FEATURES,
  GITHUB_HREF,
  INTEGRITY_POINTS,
  LOGIN_HREF,
  NAV_LINKS,
  SIGNUP_HREF,
  STEPS,
} from './content';
import { Wordmark } from './wordmark';

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  align = 'center',
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <motion.div
      {...reveal}
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'mx-auto max-w-2xl items-center text-center' : 'max-w-xl',
      )}
    >
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="font-aleo text-3xl tracking-tight text-balance md:text-4xl">
        {title}
      </h2>
      {children && <p className="text-base text-muted-foreground md:text-lg">{children}</p>}
    </motion.div>
  );
}

export function Partners() {
  return (
    <section aria-labelledby="partners-title" className="px-5 pt-14 md:pt-20">
      <motion.div {...reveal} className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        <h2 id="partners-title" className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          In association with
        </h2>
        <PartnerLogos />
      </motion.div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-24 px-5 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="how-title" eyebrow="How it works" title="One idea at a time, checked as you go">
          Every lesson follows the same simple loop.
        </SectionHeading>

        <ol className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.1 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <span className="font-aleo text-4xl text-primary">{String(i + 1).padStart(2, '0')}</span>
                  <CardTitle className="mt-3">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </CardTitle>
                  <CardDescription className="leading-relaxed">{step.body}</CardDescription>
                </CardHeader>
              </Card>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FEATURE_ICONS: Record<(typeof FEATURES)[number]['icon'], LucideIcon> = {
  target: TargetIcon,
  sparkles: SparklesIcon,
  bookmark: BookmarkIcon,
  chart: BarChart3Icon,
  shield: ShieldCheckIcon,
  code: Code2Icon,
};

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="relative isolate scroll-mt-24 overflow-hidden bg-muted/50 px-5 py-20 md:py-28"
    >
      <OrbBackground className="-z-10 opacity-70" />
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="features-title" eyebrow="Features" title="Built so understanding comes first" />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((feature, i) => {
            const Icon = FEATURE_ICONS[feature.icon];
            return (
              <motion.li
                key={feature.title}
                {...reveal}
                transition={{ ...reveal.transition, delay: (i % 3) * 0.08 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <span className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <CardTitle>
                      <h3 className="text-base font-semibold">{feature.title}</h3>
                    </CardTitle>
                    <CardDescription className="leading-relaxed">{feature.body}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Integrity() {
  return (
    <section
      id="integrity"
      aria-labelledby="integrity-title"
      className="scroll-mt-24 px-5 py-20 md:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <SectionHeading
          id="integrity-title"
          eyebrow="Integrity & privacy"
          title="Proctoring that is upfront about what it does"
          align="left"
        >
          Proctored courses use your camera and microphone to keep assessments fair. Here is
          exactly what that means for you.
        </SectionHeading>

        <ul className="grid gap-4 sm:grid-cols-2">
          {INTEGRITY_POINTS.map((point, i) => (
            <motion.li
              key={point.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.08 }}
            >
              <Card size="sm" className="h-full">
                <CardHeader>
                  <CardTitle>
                    <h3 className="text-sm font-semibold">{point.title}</h3>
                  </CardTitle>
                  <CardDescription className="leading-relaxed">{point.body}</CardDescription>
                </CardHeader>
              </Card>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-24 border-t border-border px-5 py-20 md:py-28"
    >
      <div className="mx-auto max-w-3xl">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <motion.div {...reveal} className="mt-10 md:mt-12">
          <Accordion>
            {FAQS.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionPanel>{item.a}</AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="px-3 pb-3 md:px-4 md:pb-4">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-4xl px-6 pt-16 pb-8 md:px-12 md:pt-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rotate-180 bg-footer-radial-light-mobile [--bg-pos-footer:10%] dark:bg-footer-radial-dark-mobile lg:bg-footer-radial-light lg:[--bg-pos-footer:-5%] lg:dark:bg-footer-radial-dark"
        />

        <motion.div {...reveal} className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <h2 className="font-aleo text-3xl tracking-tight text-balance md:text-5xl">
            Ready to start learning?
          </h2>
          <p className="max-w-md text-base text-foreground/75">
            Sign in to see your courses, or create an account to join one.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to={SIGNUP_HREF} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
              Get started
            </Link>
            <Link to={LOGIN_HREF}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}
            >
              Log in
            </Link>
          </div>
        </motion.div>

        <div className="mt-20 flex flex-col gap-8 rounded-2xl bg-background/85 p-6 backdrop-blur-sm md:mt-28 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Wordmark />
            <p className="text-sm text-muted-foreground">
              A learning platform from the Vicharanashala Lab for Education Design, IIT Ropar.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <p className="font-semibold">Explore</p>
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold">Project</p>
              <a href={DOCS_HREF} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                Documentation
              </a>
              <a href={GITHUB_HREF} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                GitHub
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold">Contact</p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="break-all text-muted-foreground hover:text-foreground">
                {CONTACT_EMAIL}
              </a>
            </div>
          </nav>
        </div>

        <p className="mt-6 text-center text-xs text-foreground/70">
          © {new Date().getFullYear()} ViBe · Released under the MIT licence
        </p>
      </div>
    </footer>
  );
}
