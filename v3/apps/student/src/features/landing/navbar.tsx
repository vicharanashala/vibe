import { Link } from '@tanstack/react-router';
import { MenuIcon } from 'lucide-react';
import { useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { LOGIN_HREF, NAV_LINKS, SIGNUP_HREF } from './content';
import { Wordmark } from './wordmark';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 md:top-4">
      <nav
        aria-label="Main"
        className="mx-auto w-full max-w-6xl rounded-xl border border-border/60 bg-background/80 px-4 py-2 shadow-xs backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-4">
          <a href="#top" aria-label="ViBe home" className="rounded-md py-1">
            <Wordmark />
          </a>

          <ul className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Link to={LOGIN_HREF} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Log in
            </Link>
            <Link to={SIGNUP_HREF} className={buttonVariants({ size: 'sm' })}>
              Get started
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
                <MenuIcon />
              </SheetTrigger>
              <SheetContent id="mobile-menu" side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>
                    <Wordmark />
                  </SheetTitle>
                </SheetHeader>
                <nav aria-label="Sections" className="flex flex-col gap-1 px-2">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start')}
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
                <SheetFooter>
                  <Link to={LOGIN_HREF} className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
                    Log in
                  </Link>
                  <Link to={SIGNUP_HREF} className={cn(buttonVariants(), 'w-full')}>
                    Get started
                  </Link>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
