"use client"

import { useEffect, useState } from "react"

import { LoadingState } from "@/components/loading-state"
import { ModalLogoWatermark } from "@/components/modal-logo-watermark"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
})

export type PaymentRemark = {
  id: string
  action: "edited" | "voided"
  by: string
  at: string
  detail?: string
}

export type ViewPayment = {
  id: string
  documentNumber: string
  date: string
  name: string
  orNumber: string
  maximumOfAmount: number
  memoMain: string
  minimumSalesOrderNumber: string
  minimumInvoiceNumberLeasing: string
  eligibleForRebate: string
  genericCollector: string
  location: string
  locationId?: number
  installmentId?: number
  voided?: boolean
  voidReason?: string
  edited?: boolean
  remarks: PaymentRemark[]
}

function ReadField({
  label,
  value,
  className,
  inputClassName,
}: {
  label: string
  value: string
  className?: string
  inputClassName?: string
}) {
  return (
    <label className={className ?? "flex flex-col gap-1.5"}>
      <span className="text-sm font-semibold text-blue-950">{label}</span>
      <Input
        readOnly
        tabIndex={-1}
        value={value}
        className={
          inputClassName ??
          "h-10 cursor-default bg-blue-50/60 text-blue-950 shadow-none focus-visible:ring-0"
        }
      />
    </label>
  )
}

export function ViewPaymentModal({
  open,
  onOpenChangeAction,
  payment,
}: {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  payment: ViewPayment | null
}) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !payment) return
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, payment])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent className="flex max-h-[min(90svh,56rem)] w-[min(48rem,calc(100%-2rem))] max-w-none! flex-col gap-0 overflow-hidden p-0 shadow-lg ring-blue-200 sm:max-w-none!">
        <div className="shrink-0 bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-6 py-5 text-white">
          <AlertDialogTitle className="text-xl">
            {payment ? payment.documentNumber : "Payment"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-blue-100">
            Full payment record for this collection.
          </AlertDialogDescription>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ModalLogoWatermark />
          {loading ? (
            <div className="relative z-10 bg-white/80">
              <LoadingState />
            </div>
          ) : (
            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <ReadField
                    label="Document number"
                    value={payment?.documentNumber || "—"}
                  />
                  <ReadField label="Date" value={payment?.date || "—"} />
                  <ReadField
                    label="Name"
                    value={payment?.name || "—"}
                    className="flex flex-col gap-1.5 sm:col-span-2"
                  />
                  <ReadField label="OR number" value={payment?.orNumber || "—"} />
                  <ReadField
                    label="Maximum of amount"
                    value={
                      payment ? peso.format(payment.maximumOfAmount) : "—"
                    }
                    inputClassName="h-10 cursor-default bg-blue-50/60 text-blue-950 tabular-nums shadow-none focus-visible:ring-0"
                  />
                  <ReadField
                    label="Memo (main)"
                    value={payment?.memoMain || "—"}
                    className="flex flex-col gap-1.5 sm:col-span-2"
                  />
                  <ReadField
                    label="Minimum of sales order number"
                    value={payment?.minimumSalesOrderNumber || "—"}
                  />
                  <ReadField
                    label="Minimum of invoice number - leasing"
                    value={payment?.minimumInvoiceNumberLeasing || "—"}
                  />
                  <ReadField
                    label="Eligible for rebate"
                    value={payment?.eligibleForRebate || "—"}
                  />
                  <ReadField
                    label="Generic collector"
                    value={payment?.genericCollector || "—"}
                  />
                  <ReadField
                    label="Location"
                    value={payment?.location || "—"}
                    className="flex flex-col gap-1.5 sm:col-span-2"
                  />
                  {payment?.voided ? (
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-sm font-semibold text-red-800">Void reason</span>
                      <Textarea
                        readOnly
                        tabIndex={-1}
                        value={
                          payment.voidReason ||
                          payment.remarks.find((remark) => remark.action === "voided")?.detail ||
                          "—"
                        }
                        className="min-h-20 cursor-default resize-none bg-red-50/70 text-blue-950 shadow-none focus-visible:ring-0"
                      />
                    </label>
                  ) : null}
                </div>
                <div className="mt-5 overflow-hidden rounded-xl bg-white/90 shadow-md ring-1 ring-blue-200">
                  <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
                    <h3 className="text-sm font-semibold tracking-tight text-blue-950">Remarks</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Record of who edited or voided this payment.
                    </p>
                  </div>
                  {payment && payment.remarks.length > 0 ? (
                    <ul className="divide-y divide-blue-100">
                      {payment.remarks.map((remark) => (
                        <li
                          key={remark.id}
                          className={
                            remark.action === "voided"
                              ? "bg-red-50/80 px-4 py-3"
                              : "bg-blue-50/70 px-4 py-3"
                          }
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                remark.action === "voided"
                                  ? "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-red-700 ring-1 ring-red-200"
                                  : "inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-blue-800 ring-1 ring-blue-200"
                              }
                            >
                              {remark.action === "voided" ? "Voided" : "Edited"}
                            </span>
                            <span className="text-sm font-medium text-blue-950">{remark.by}</span>
                            <span className="text-xs text-muted-foreground">{remark.at}</span>
                          </div>
                          {remark.detail ? (
                            <p className="mt-1.5 text-sm leading-5 text-blue-950/80">{remark.detail}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No remarks are recorded yet.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end border-t border-blue-100 bg-blue-50/50 px-6 py-4">
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer bg-blue-800 px-3 text-white hover:bg-blue-900"
                  onClick={() => onOpenChangeAction(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
