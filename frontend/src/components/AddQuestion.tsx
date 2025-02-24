'use client'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { QuestionTabSwitcher } from './ui/QuestionTabSwitcher'

export function AddQuestion() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='outline'>Suggest a question</Button>
      </DrawerTrigger>
      <DrawerContent>
        <QuestionTabSwitcher />
      </DrawerContent>
    </Drawer>
  )
}
