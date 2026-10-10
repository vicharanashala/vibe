import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, CheckIcon, PlayIcon, ShieldCheckIcon } from 'lucide-react';
import { motion } from 'motion/react';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { SIGNUP_HREF } from './content';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' as const },
});

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="px-3 pt-24 md:px-4 md:pt-28">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-4xl px-5 pt-12 pb-10 sm:px-8 md:px-12 lg:pt-20 lg:pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-hero-radial-light [--bg-mid-alt:78%] [--bg-mid:50%] [--bg-pos:0%] dark:bg-hero-radial-dark lg:[--bg-mid-alt:72%] lg:[--bg-mid:42%]"
        />

        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <motion.p
              {...fadeUp(0.05)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur-sm"
            >
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              Vicharanashala Lab for Education Design, IIT Ropar
            </motion.p>

            <motion.h1
              id="hero-title"
              {...fadeUp(0.15)}
              className="max-w-xl font-aleo text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl xl:text-6xl"
            >
              Learn it. Prove it. Then move on.
            </motion.h1>

            <motion.p
              {...fadeUp(0.25)}
              className="max-w-lg text-base text-foreground/75 sm:text-lg"
            >
              ViBe checks your understanding as you learn. Short lessons, checkpoint
              questions after every segment, and a quick review whenever something
              didn&apos;t stick.
            </motion.p>

            <motion.div
              {...fadeUp(0.35)}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            >
              <Link to={SIGNUP_HREF} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
                Start learning
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <a
                href="#how-it-works"
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}
              >
                See how it works
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
          >
            <LessonPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** Illustrative product preview — decorative, so hidden from assistive tech. */
function LessonPreview() {
  const options = ['A linked list', 'A hash map', 'A binary heap'];

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md sm:pb-20 lg:max-w-none">
      <Card className="gap-0 py-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs">
          <span className="font-medium">Module 2 · Data structures</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-primary" />
            Proctored
          </span>
        </div>
        <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-primary/25 via-secondary/15 to-primary/5">
          <span className="grid size-14 place-items-center rounded-full bg-background/90 shadow-md">
            <PlayIcon className="ml-0.5 size-6 fill-foreground" />
          </span>
          <Progress value={67} aria-label="Lesson progress" className="absolute inset-x-4 bottom-4 [&_[data-slot=progress-track]]:bg-background/60" />
        </div>
        <div className="space-y-1 px-4 py-3">
          <p className="text-sm font-medium">Segment 3 · Lookups by key</p>
          <p className="text-xs text-muted-foreground">Checkpoint after this segment</p>
        </div>
      </Card>

      <Card size="sm" className="relative z-10 -mt-3 ml-6 px-4 shadow-2xl sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:ml-0 sm:w-80">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Checkpoint</p>
        <p className="mt-1 text-sm font-medium">
          Which structure gives constant-time lookups by key on average?
        </p>
        <ItemGroup className="gap-2">
          {options.map((option, i) => {
            const chosen = i === 1;
            return (
              <Item key={option} variant="outline" size="xs" className={cn('px-3', chosen && 'border-primary bg-primary/10')}>
                <ItemContent>
                  <ItemTitle className="font-normal">{option}</ItemTitle>
                </ItemContent>
                {chosen && (
                  <ItemActions>
                    <CheckIcon className="size-4 text-primary" />
                  </ItemActions>
                )}
              </Item>
            );
          })}
        </ItemGroup>
      </Card>
    </div>
  );
}
