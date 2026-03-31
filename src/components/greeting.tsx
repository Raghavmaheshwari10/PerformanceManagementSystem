'use client'

import { useEffect, useState } from 'react'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState('Hello')

  useEffect(() => {
    setGreeting(getGreeting())
    // Update every minute
    const interval = setInterval(() => setGreeting(getGreeting()), 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <p className="text-sm font-semibold text-slate-900">
      {greeting}, {name}
    </p>
  )
}
