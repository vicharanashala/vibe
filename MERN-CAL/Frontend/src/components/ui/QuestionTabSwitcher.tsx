import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from './textarea'
import { useState } from 'react'
import { QuestionWritingQuery } from './QuestionWritingQuery'

export function QuestionTabSwitcher() {
  const [blanks, setBlanks] = useState([{ placeholder: '', answer: '' }])
  const [selectedOption, setSelectedOption] = useState('')

  const handleAddBlank = () => {
    setBlanks([...blanks, { placeholder: '', answer: '' }])
  }
  console.log('blanks:', blanks)

  const handlePlaceholderChange = (index, value) => {
    const newBlanks = [...blanks]
    newBlanks[index].placeholder = value
    setBlanks(newBlanks)
  }

  const handleAnswerChange = (index, value) => {
    const newBlanks = [...blanks]
    newBlanks[index].answer = value
    setBlanks(newBlanks)
  }

  return (
    <Tabs defaultValue='mcq' className='my-10 w-full px-10'>
      <TabsList className='grid w-[900px] grid-cols-5'>
        <TabsTrigger value='mcq'>Multiple Choice Question</TabsTrigger>
        <TabsTrigger value='trueFalse'>True False</TabsTrigger>
        <TabsTrigger value='msq'>Multiple Select Question</TabsTrigger>
        <TabsTrigger value='descriptive'>Descriptive Questions</TabsTrigger>
        <TabsTrigger value='fillUps'>Fill in the blanks</TabsTrigger>
      </TabsList>
      <TabsContent value='mcq'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Multiple Choice Question</CardTitle>
                <CardDescription>
                  There should be only one correct answer
                </CardDescription>
              </div>
              <h1 className='text-sm font-semibold text-red-600'>
                Note : Check the correct answer
              </h1>
            </div>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='space-y-1'>
              <Label htmlFor='question'>Question</Label>
              <Textarea
                id='question'
                placeholder='Write your question here ...'
              />
            </div>
            {['option1', 'option2', 'option3', 'option4'].map(
              (option, index) => (
                <div key={index} className='flex items-center space-x-2'>
                  <Label htmlFor={option}>{`Option ${index + 1}`}</Label>
                  <Input
                    id={option}
                    placeholder='Option Text'
                    className='flex-1'
                  />
                  <input
                    type='radio'
                    name='mcqOption'
                    id={`radio-${option}`}
                    className='size-4'
                    style={{ accentColor: 'black' }}
                  />
                </div>
              )
            )}
          </CardContent>
          <CardFooter>
            <Button>Publish</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value='trueFalse'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>True False</CardTitle>
                <CardDescription>
                  Answer should be either true or false
                </CardDescription>
              </div>
              <h1 className='text-sm font-semibold text-red-600'>
                Note : Select the correct answer
              </h1>
            </div>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='space-y-1'>
              <Label htmlFor='question'>Question</Label>
              <Textarea
                id='question'
                placeholder='Write your question here ...'
              />
            </div>
            <div className='flex items-center space-x-4'>
              <Button
                variant={selectedOption === 'true' ? '' : 'outline'}
                className='flex-1'
                onClick={() => setSelectedOption('true')}
              >
                True
              </Button>
              <Button
                variant={selectedOption === 'false' ? '' : 'outline'}
                className='flex-1'
                onClick={() => setSelectedOption('false')}
              >
                False
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button>Publish</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value='msq'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Multiple Select Question</CardTitle>
                <CardDescription>
                  There can be multiple correct answers but at least one should
                  be wrong
                </CardDescription>
              </div>
              <h1 className='text-sm font-semibold text-red-600'>
                Note : Check all the correct answers
              </h1>
            </div>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='space-y-1'>
              <Label htmlFor='question'>Question</Label>
              <Textarea
                id='question'
                placeholder='Write your question here ...'
              />
            </div>
            {['option1', 'option2', 'option3', 'option4'].map(
              (option, index) => (
                <div key={index} className='flex items-center space-x-2'>
                  <Label htmlFor={option}>{`Option ${index + 1}`}</Label>
                  <Input
                    id={option}
                    placeholder='Option Text'
                    className='flex-1'
                  />
                  <input
                    type='checkbox'
                    name='msqOption'
                    id={`checkbox-${option}`}
                    className='size-4'
                    style={{ accentColor: 'black' }}
                  />
                </div>
              )
            )}
          </CardContent>
          <CardFooter>
            <Button>Publish</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value='descriptive'>
        <Card>
          <CardHeader>
            <CardTitle>Descriptive Question</CardTitle>
            <CardDescription>
              Provide a detailed answer to the question.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='space-y-1'>
              <Label htmlFor='question'>Question</Label>
              <Textarea
                id='question'
                placeholder='Write your question here ...'
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='descriptiveAnswer'>Any Possible Answer</Label>
              <Textarea
                className='h-40'
                id='descriptiveAnswer'
                placeholder='Write Answer here ...'
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Publish</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value='fillUps'>
        <Card className='h-[500px] overflow-y-scroll'>
          <CardHeader>
            <div className='flex justify-between'>
              <CardTitle>Fill in the Blanks</CardTitle>
              <QuestionWritingQuery />
            </div>
            <CardDescription>
              Add a blank and specify an answer for it.{' '}
              <span className='text-red-600'>( Use * instead of blank )</span>
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {blanks.map((blank, index) => (
              <div key={index} className='space-y-1'>
                <Label htmlFor={`blank${index}`}>Blank {index + 1}</Label>
                <Input
                  id={`blank${index}`}
                  placeholder='Enter placeholder text for blank'
                  value={blank.placeholder}
                  onChange={(e) =>
                    handlePlaceholderChange(index, e.target.value)
                  }
                />
                <Label htmlFor={`answer${index}`}>
                  Answer for Blank {index + 1}
                </Label>
                <Input
                  id={`answer${index}`}
                  placeholder='Enter answer for blank'
                  value={blank.answer}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                />
              </div>
            ))}
            <Button onClick={handleAddBlank}>Add Another Blank</Button>
          </CardContent>
          <CardFooter className='flex justify-between'>
            <div className='ml-auto flex gap-4'>
              <Button
                onClick={() => setBlanks([{ placeholder: '', answer: '' }])}
              >
                Reset
              </Button>
              <Button>Publish</Button>
            </div>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
