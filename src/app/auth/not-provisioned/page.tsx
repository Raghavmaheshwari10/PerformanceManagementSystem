import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotProvisionedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Account Not Set Up</h1>
        <p className="max-w-md text-muted-foreground">
          Your Google account has been verified, but you haven&apos;t been added to PMS yet.
          Please contact your HR administrator to get access.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/login">Back to Login</Link>
      </Button>
    </div>
  )
}
