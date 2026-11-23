"use client"

import { useEffect, useState, type FormEvent } from "react"

import { LoadingState } from "@/components/loading-state"
import { ModalError } from "@/components/modal-error"
import { ModalLogoWatermark } from "@/components/modal-logo-watermark"
import { withRemarkDateTime, type ViewPayment } from "@/components/view-payment-modal"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toApiErrorMessage } from "@/lib/apiService"

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
})

export function VoidPaymentModal({
  open,
  payment,
  onOpenChangeAction,
  onVoidedAction,
}: {
  open: boolean
  payment: ViewPayment | null
  onOpenChangeAction: (open: boolean) => void
  onVoidedAction: (payment: ViewPayment, reason: string) => void | Promise<void>
}) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !payment) return
    let cancelled = false
    setReason("")
    setError("")
    setVoiding(false)
    setLoading(true)
    const timer = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, payment])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!payment) return
    const nextReason = reason.trim()
    if (!nextReason) {
      setError("Enter a reason for voiding this payment.")
      return
    }
    setVoiding(true)
    setError("")
    try {
      await onVoidedAction(payment, withRemarkDateTime(nextReason))
      onOpenChangeAction(false)
    } catch (voidError) {
      setError(toApiErrorMessage(voidError, "This payment could not be voided."))
    } finally {
      setVoiding(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent className="w-[min(32rem,calc(100%-2rem))] max-w-none! gap-0 overflow-hidden p-0 shadow-lg ring-blue-200 sm:max-w-none!">
        <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-6 py-5 text-white">
          <AlertDialogTitle className="text-xl font-semibold">Void this payment?</AlertDialogTitle>
          <AlertDialogDescription className="mt-1 text-sm text-blue-100">
            This collection will be marked void. Give a reason before continuing.
          </AlertDialogDescription>
        </div>
        <div className="relative">
          <ModalLogoWatermark />
          {loading ? (
            <div className="relative z-10 bg-white/80">
              <LoadingState />
            </div>
          ) : (
            <form className="relative z-10" onSubmit={submit}>
              {payment ? (
                <div className="px-6 py-5">
                  <p className="text-lg font-semibold text-blue-950">{payment.documentNumber}</p>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="font-medium text-blue-950">{payment.name || "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">OR number</dt>
                      <dd className="font-medium text-blue-950">{payment.orNumber || "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Amount</dt>
                      <dd className="font-medium tabular-nums text-blue-950">
                        {peso.format(payment.maximumOfAmount)}
                      </dd>
                    </div>
                  </dl>
                  <label className="mt-5 flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-blue-950">Reason</span>
                    <Textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why is this payment being voided?"
                      className="min-h-24 bg-white text-blue-950"
                    />
                  </label>
                  {error ? (
                    <div className="mt-4">
                      <ModalError title="This payment was not voided" message={error} />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-blue-100 bg-blue-50/80 px-6 py-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer bg-white px-4 text-blue-950"
                  disabled={voiding}
                  onClick={() => onOpenChangeAction(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="cursor-pointer bg-red-600 px-4 text-white hover:bg-red-700"
                  disabled={voiding || !payment}
                >
                  {voiding ? "Voiding" : "Void payment"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
