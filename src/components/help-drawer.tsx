'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface HelpDrawerProps {
  title: string
  children: React.ReactNode
}

export function HelpDrawer({ title, children }: HelpDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <HelpCircle size={16} />
          Help
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[540px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 prose prose-sm max-w-none text-sm leading-relaxed">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
