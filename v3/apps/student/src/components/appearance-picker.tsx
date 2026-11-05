import { MoonIcon, SunIcon } from 'lucide-react';

import { useTheme, type Theme } from '@/components/theme-provider';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PALETTES, type PaletteId } from '@/lib/palettes';

/** Light/dark plus colour palette. Used in onboarding, Profile, and the studio's Appearance dialog. Changes apply instantly. */
export function AppearancePicker({
  className,
  columns = 2,
}: {
  className?: string;
  columns?: 2 | 3;
}) {
  const { theme, setTheme, palette, setPalette } = useTheme();

  return (
    <div className={cn('grid gap-5', className)}>
      <Field>
        <FieldLabel id="appearance-mode">Mode</FieldLabel>
        <Tabs value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <TabsList
            aria-labelledby="appearance-mode"
            className="w-full sm:w-fit"
          >
            <TabsTrigger value="light">
              <SunIcon aria-hidden /> Light
            </TabsTrigger>
            <TabsTrigger value="dark">
              <MoonIcon aria-hidden /> Dark
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>

      <Field>
        <FieldLabel id="appearance-palette">Colours</FieldLabel>
        <RadioGroup
          aria-labelledby="appearance-palette"
          value={palette}
          onValueChange={(v) => setPalette(v as PaletteId)}
          className={cn(
            'grid gap-3',
            columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          )}
        >
          {PALETTES.map((p) => (
            <FieldLabel
              key={p.id}
              htmlFor={`palette-${p.id}`}
              className="has-data-checked:border-primary"
            >
              <Field orientation="horizontal" className="items-start">
                <FieldContent className="gap-2.5">
                  <span
                    aria-hidden
                    className="flex h-8 overflow-hidden rounded-md border border-black/5"
                  >
                    {p.swatches.map((c) => (
                      <span
                        key={c}
                        className="flex-1"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="grid gap-0.5">
                    <FieldTitle>{p.name}</FieldTitle>
                    <FieldDescription className="text-xs">
                      {p.description}
                    </FieldDescription>
                  </span>
                </FieldContent>
                <RadioGroupItem
                  value={p.id}
                  id={`palette-${p.id}`}
                  aria-label={p.name}
                />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </Field>
    </div>
  );
}
