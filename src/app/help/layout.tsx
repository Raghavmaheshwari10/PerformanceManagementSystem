import Link from 'next/link'

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href="/help"
          className="hover:text-foreground transition-colors font-medium"
        >
          Help
        </Link>
      </div>
      {children}
    </div>
  )
}
