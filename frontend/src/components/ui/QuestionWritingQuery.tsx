import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Info } from 'lucide-react'
import { Label } from './label'
import { Input } from './input'
import { Textarea } from './textarea'

export function QuestionWritingQuery() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className='flex items-center gap-x-2 text-sm'>
          <Info className='h-5' />
          Need help ? How to write question !
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <h1 className='text-lg font-bold'>For Example :</h1>
        <p>
          Question : In JavaScript, to declare a variable that cannot be
          reassigned, use the keyword _____ . To remove and return the last
          element of an array, you would use the method ____.pop().
        </p>
        <p className='ml-auto text-sm text-red-600'>Note : Use * for Blank</p>
        <div key={1} className='space-y-1'>
          <Label htmlFor={`blank1`}>Blank {1}</Label>
          <Textarea
            id={`blank1`}
            value='In JavaScript, to declare a variable that cannot be reassigned, use the keyword *'
            readOnly
          />
          <Label htmlFor={`answer1`}>Answer for Blank {1}</Label>
          <Input id={`answer1`} value='const' readOnly />
          <Label htmlFor={`blank2`}>Blank {2}</Label>
          <Textarea
            id={`blank2`}
            value='To remove and return the last element of an array, you would use the method * .pop'
            readOnly
          />
          <Label htmlFor={`answer2`}>Answer for Blank {2}</Label>
          <Input id={`answer2`} value='array' readOnly />
        </div>
        <AlertDialogCancel>Close</AlertDialogCancel>
      </AlertDialogContent>
    </AlertDialog>
  )
}
