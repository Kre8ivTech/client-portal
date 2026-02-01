'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PayInvoiceButtonProps {
  invoice: {
    id: string
    invoice_number: string
    balance_due: number
    currency: string
  }
}

export function PayInvoiceButton({ invoice }: PayInvoiceButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handlePayment = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Create Stripe checkout session
      const response = await fetch(`/api/invoices/${invoice.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      if (!url) {
        throw new Error('No checkout URL returned')
      }

      // Redirect to Stripe Checkout
      window.location.href = url
    } catch (err) {
      console.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initiate payment')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handlePayment}
        disabled={isLoading}
        size="lg"
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: invoice.currency,
            }).format(invoice.balance_due / 100)}
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
