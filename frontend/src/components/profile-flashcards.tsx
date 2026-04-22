"use client"

import { useMemo, useState } from "react"
import { Brain, CheckCircle2, HelpCircle, RotateCcw, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/utils/utils"

type Flashcard = {
  question: string
  answer: string
}

const flashcards: Flashcard[] = [
  { question: "What is React?", answer: "A JavaScript library for building user interfaces." },
  { question: "What is Node.js?", answer: "A JavaScript runtime used to run JS outside the browser." },
  { question: "What is MongoDB?", answer: "A NoSQL document database for flexible, scalable data storage." },
]

export default function ProfileFlashcards() {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const currentCard = flashcards[index]
  const progress = `${index + 1}/${flashcards.length}`

  const completion = useMemo(
    () => Math.round(((index + 1) / flashcards.length) * 100),
    [index],
  )

  const handleNextCard = () => {
    setFlipped(false)
    setIndex((prev) => (prev + 1) % flashcards.length)
  }

  const handleRestart = () => {
    setFlipped(false)
    setIndex(0)
  }

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
      <CardHeader className="gap-4 border-b border-border/60 pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit gap-2 bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Flashcard Game
            </Badge>
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Brain className="h-5 w-5 text-primary" />
              Quick Practice Deck
            </CardTitle>
            <CardDescription>
              Review a few core concepts right from your ViBe profile.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background/70">
              Card {progress}
            </Badge>
            <Badge variant="outline" className="bg-background/70">
              {completion}% explored
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className="relative mx-auto w-full max-w-2xl [perspective:1400px]">
              <button
                type="button"
                onClick={() => setFlipped((prev) => !prev)}
                className="group block h-72 w-full cursor-pointer rounded-3xl bg-transparent text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={flipped ? "Show question side" : "Show answer side"}
              >
                <div
                  className={cn(
                    "relative h-full w-full rounded-3xl transition-transform duration-700 [transform-style:preserve-3d]",
                    flipped && "[transform:rotateY(180deg)]",
                  )}
                >
                  <div className="absolute inset-0 flex h-full w-full [backface-visibility:hidden]">
                    <div className="flex h-full w-full flex-col justify-between rounded-3xl border border-primary/20 bg-gradient-to-br from-amber-50 via-card to-orange-100 p-6 shadow-xl dark:from-zinc-900 dark:via-card dark:to-orange-950/60">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="border-primary/30 bg-background/70">
                          Question
                        </Badge>
                        <HelpCircle className="h-5 w-5 text-primary/80" />
                      </div>

                      <div className="space-y-4">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Tap to reveal
                        </p>
                        <h3 className="text-2xl font-semibold leading-snug md:text-3xl">
                          {currentCard.question}
                        </h3>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Use this deck for a quick memory check before your next session.
                      </p>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="flex h-full w-full flex-col justify-between rounded-3xl border border-primary/15 bg-gradient-to-br from-primary via-orange-400 to-amber-300 p-6 text-primary-foreground shadow-xl dark:from-orange-500 dark:via-amber-500 dark:to-yellow-400">
                      <div className="flex items-center justify-between">
                        <Badge className="border-white/20 bg-white/15 text-white shadow-none">
                          Answer
                        </Badge>
                        <CheckCircle2 className="h-5 w-5 text-white/90" />
                      </div>

                      <div className="space-y-4">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/75">
                          Nicely done
                        </p>
                        <h3 className="text-2xl font-semibold leading-snug md:text-3xl">
                          {currentCard.answer}
                        </h3>
                      </div>

                      <p className="text-sm text-white/75">
                        Flip again if you want to challenge yourself one more time.
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setFlipped((prev) => !prev)}>
                {flipped ? "Show Question" : "Reveal Answer"}
              </Button>
              <Button variant="outline" onClick={handleNextCard}>
                Next Card
              </Button>
              <Button variant="ghost" onClick={handleRestart}>
                <RotateCcw className="h-4 w-4" />
                Restart
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">How to play</p>
              <div className="mt-4 space-y-3 text-sm">
                <p>1. Read the prompt on the card.</p>
                <p>2. Flip it to check the answer.</p>
                <p>3. Move ahead when you are ready for the next concept.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
              <p className="text-sm font-medium text-muted-foreground">Deck snapshot</p>
              <div className="mt-4 space-y-3">
                {flashcards.map((card, cardIndex) => (
                  <div
                    key={card.question}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm transition-colors",
                      cardIndex === index
                        ? "border-primary/30 bg-background shadow-sm"
                        : "border-border/60 bg-background/60",
                    )}
                  >
                    <p className="font-medium">Card {cardIndex + 1}</p>
                    <p className="mt-1 text-muted-foreground">{card.question}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
