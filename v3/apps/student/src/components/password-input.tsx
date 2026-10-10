import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

/** shadcn InputGroup password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof InputGroupInput>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup className={cn('h-11 sm:h-10', className)}>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
