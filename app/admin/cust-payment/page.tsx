"use client"

import { useEffect, useState } from "react"
import { Ban, ChevronDown, Eye, Pencil, RefreshCw, Search } from "lucide-react"

import { LoadingState } from "@/components/loading-state"
import { ErrorModal, SuccessModal } from "@/components/status-modals"
import { TableEmpty } from "@/components/table-empty"
import { EditPaymentModal } from "@/components/edit-payment-modal"
import { ViewPaymentModal, type PaymentRemark, type ViewPayment } from "@/components/view-payment-modal"
import { VoidPaymentModal } from "@/components/void-payment-modal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiService, toApiErrorMessage } from "@/lib/apiService"

const columns = [
  "Document number",
  "Date",
  "Name",
  "OR number",
  "Maximum of amount",
  "Minimum of sales order number",
  "Actions",
]

type PaymentRow = ViewPayment
type PaymentStatusFilter = "all" | "active" | "voided"

const statusFilterLabels: Record<PaymentStatusFilter, string> = {
  all: "All statuses",
  active: "Active",
  voided: "Voided",
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
})

const displayDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const remarkWhen = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function pageNumbers(current: number, last: number) {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)
  const items: (number | "ellipsis")[] = [1]
  if (current > 3) items.push("ellipsis")
  for (let page = Math.max(2, current - 1); page <= Math.min(last - 1, current + 1); page += 1) {
    items.push(page)
  }
  if (current < last - 2) items.push("ellipsis")
  items.push(last)
  return items
}

function textOf(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

function formatDate(value: string) {
  if (!value) return ""
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return displayDate.format(date)
}

function toApiDate(value: string) {
  const text = value.trim()
  if (!text) return text
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function locationOf(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (value && typeof value === "object") {
    const record = value as { location_name?: unknown; name?: unknown }
    return textOf(record.location_name) || textOf(record.name)
  }
  return ""
}

function idOf(value: unknown) {
  const number = typeof value === "number" ? value : Number(textOf(value))
  return Number.isFinite(number) && number > 0 ? number : undefined
}

function relationId(value: unknown, fallback?: unknown) {
  if (value && typeof value === "object") {
    const id = idOf((value as { id?: unknown }).id)
    if (id) return id
  }
  return idOf(fallback)
}

function readRemarks(value: unknown, editedBy?: string): PaymentRemark[] {
  if (typeof value === "string") {
    const detail = value.trim()
    if (!detail) return []
    return [
      {
        id: "edit-remark",
        action: "edited",
        by: editedBy || "Admin",
        at: "",
        detail,
      },
    ]
  }
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const actionText = textOf(row.action).toLowerCase()
    const action = actionText === "voided" ? "voided" : actionText === "edited" ? "edited" : null
    if (!action) return []
    const atRaw = textOf(row.at) || textOf(row.created_at) || textOf(row.updated_at)
    return [
      {
        id: textOf(row.id) || `remark-${index}`,
        action,
        by: textOf(row.by) || textOf(row.user_name) || textOf(row.user) || editedBy || "Admin",
        at: atRaw ? formatDate(atRaw) || remarkWhen.format(new Date(atRaw)) : "",
        detail: textOf(row.detail) || textOf(row.reason) || textOf(row.message) || undefined,
      },
    ]
  })
}

function installmentOf(value: unknown) {
  if (!value || typeof value !== "object") return null
  return value as { customer_name?: unknown; so_number?: unknown; name?: unknown }
}

function readPayment(item: unknown): PaymentRow | null {
  if (!item || typeof item !== "object") return null
  const row = item as Record<string, unknown>
  const id = textOf(row.id)
  if (!id) return null
  const installment = installmentOf(row.installment)
  const voidFlag = row.is_void ?? row.is_voided ?? row.voided
  const voided =
    voidFlag === true ||
    voidFlag === 1 ||
    textOf(voidFlag).toLowerCase() === "1" ||
    textOf(voidFlag).toLowerCase() === "true" ||
    textOf(row.status).toLowerCase() === "voided" ||
    textOf(row.status).toLowerCase() === "void"
  const rebateRaw =
    textOf(row.eligible_for_rebate) ||
    textOf(row.isrebatable) ||
    textOf(row.is_rebatable)
  const rebate = rebateRaw.toLowerCase()
  const dateRaw = textOf(row.payment_date) || textOf(row.date)
  const editedByRecord =
    row.editedBy && typeof row.editedBy === "object"
      ? (row.editedBy as { name?: unknown })
      : null
  const editedByName = textOf(editedByRecord?.name)
  const remarks = readRemarks(row.remarks, editedByName)
  const edited =
    !voided &&
    (!!idOf(row.edited_by) ||
      !!editedByName ||
      remarks.some((remark) => remark.action === "edited") ||
      (typeof row.remarks === "string" && row.remarks.trim().length > 0))
  return {
    id,
    documentNumber: textOf(row.document_number) || "—",
    date: formatDate(dateRaw) || dateRaw || "—",
    name:
      textOf(installment?.customer_name) ||
      textOf(installment?.name) ||
      textOf(row.name) ||
      textOf(row.customer_name) ||
      "—",
    orNumber: textOf(row.or_number),
    maximumOfAmount: Number(row.amount ?? row.maximum_of_amount) || 0,
    memoMain: textOf(row.memo_description) || textOf(row.memo_main),
    minimumSalesOrderNumber:
      textOf(installment?.so_number) ||
      textOf(row.minimum_sales_order_number) ||
      textOf(row.minimum_sales_order_number_for_dp) ||
      textOf(row.so_number),
    minimumInvoiceNumberLeasing:
      textOf(row.invoice_number) || textOf(row.minimum_invoice_number_leasing),
    eligibleForRebate:
      rebate === "yes" || rebate === "1"
        ? "Yes"
        : rebate === "no" || rebate === "0"
          ? "No"
          : rebateRaw,
    genericCollector: textOf(row.generic_collector),
    location: locationOf(row.location),
    locationId: relationId(row.location, row.location_id),
    installmentId: relationId(row.installment, row.installment_id),
    voided: voided || undefined,
    voidReason:
      textOf(row.reasonToVoid) ||
      textOf(row.reason_to_void) ||
      textOf(row.void_reason) ||
      textOf(row.reason) ||
      undefined,
    edited: edited || undefined,
    remarks,
  }
}

function paymentList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return []
  const record = payload as {
    payments?: { data?: unknown } | unknown[]
    data?: unknown
  }
  const payments = record.payments
  if (Array.isArray(payments)) return payments
  if (payments && typeof payments === "object" && Array.isArray(payments.data)) return payments.data
  if (Array.isArray(record.data)) return record.data
  return []
}

function readPayments(payload: unknown): PaymentRow[] {
  return paymentList(payload).flatMap((item) => {
    const payment = readPayment(item)
    return payment ? [payment] : []
  })
}

function readPaymentPage(payload: unknown, count: number) {
  const record =
    payload && typeof payload === "object"
      ? (payload as { payments?: { current_page?: number; last_page?: number }; current_page?: number; last_page?: number })
      : null
  const pager = record?.payments && !Array.isArray(record.payments) ? record.payments : record
  const currentPage = pager?.current_page && pager.current_page > 0 ? pager.current_page : 1
  const lastPage = pager?.last_page && pager.last_page > 0 ? pager.last_page : 1
  return { currentPage, lastPage: Math.max(lastPage, count > 0 ? 1 : 1) }
}

function asPayloadId(value: number | undefined, fallback: string) {
  const fromId = value != null && Number.isFinite(value) ? value : Number(fallback)
  return Number.isFinite(fromId) ? fromId : 0
}

function paymentPayload(payment: ViewPayment, remarks: string): Record<string, unknown> {
  return {
    document_number: payment.documentNumber,
    payment_date: toApiDate(payment.date),
    or_number: payment.orNumber,
    amount: payment.maximumOfAmount,
    memo_description: payment.memoMain,
    invoice_number: payment.minimumInvoiceNumberLeasing,
    locationId: asPayloadId(payment.locationId, payment.location),
    installmentId: asPayloadId(payment.installmentId, payment.minimumSalesOrderNumber),
    isrebatable:
      payment.eligibleForRebate.toLowerCase() === "yes"
        ? 1
        : payment.eligibleForRebate.toLowerCase() === "no"
          ? 0
          : payment.eligibleForRebate,
    generic_collector: payment.genericCollector,
    remarks: remarks.trim(),
  }
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || "?"
}

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all")
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [error, setError] = useState("")
  const [viewing, setViewing] = useState<PaymentRow | null>(null)
  const [editing, setEditing] = useState<PaymentRow | null>(null)
  const [voiding, setVoiding] = useState<PaymentRow | null>(null)
  const [successNotice, setSuccessNotice] = useState<{
    title: string
    description: string
  } | null>(null)
  const [errorNotice, setErrorNotice] = useState<{
    title: string
    description: string
  } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim()
      setSearch((current) => {
        if (current !== next) setPage(1)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const data = await apiService.getPayments(page, search, statusFilter)
        if (!cancelled) {
          const next = readPayments(data).filter((payment) => {
            if (statusFilter === "voided") return !!payment.voided
            if (statusFilter === "active") return !payment.voided
            return true
          })
          const pager = readPaymentPage(data, next.length)
          setPayments(next)
          setPage(pager.currentPage)
          setLastPage(pager.lastPage)
        }
      } catch (loadError) {
        if (!cancelled) {
          setPayments([])
          setError(toApiErrorMessage(loadError, "Payments could not be loaded."))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadKey, search, statusFilter])

  function refresh() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function savePayment(next: ViewPayment, remarks: string) {
    try {
      await apiService.updatePayment(next.id, paymentPayload(next, remarks))
      setEditing(null)
      setViewing((current) => (current?.id === next.id ? next : current))
      setReloadKey((key) => key + 1)
      setSuccessNotice({
        title: "Payment updated",
        description: `${next.documentNumber} was saved.`,
      })
    } catch (failure) {
      setEditing(null)
      setErrorNotice({
        title: "Update failed",
        description: toApiErrorMessage(failure, "This payment could not be saved."),
      })
    }
  }

  async function voidPayment(payment: ViewPayment, reason: string) {
    try {
      await apiService.voidPayment(payment.id, reason)
      const updated: PaymentRow = {
        ...payment,
        voided: true,
        voidReason: reason,
        remarks: [
          {
            id: `void-${Date.now()}`,
            action: "voided",
            by: "Admin",
            at: remarkWhen.format(new Date()),
            detail: reason,
          },
          ...payment.remarks,
        ],
      }
      setVoiding(null)
      setViewing((current) => (current?.id === updated.id ? updated : current))
      setReloadKey((key) => key + 1)
      setSuccessNotice({
        title: "Payment voided",
        description: `${payment.documentNumber} was marked void.`,
      })
    } catch (failure) {
      setVoiding(null)
      setErrorNotice({
        title: "Void failed",
        description: toApiErrorMessage(failure, "This payment could not be voided."),
      })
    }
  }

  return (
    <section className="flex h-[calc(100svh-11.5rem)] min-h-0 flex-col sm:h-[calc(100svh-12.5rem)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-blue-200">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-blue-100 px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-blue-950">Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Collection records posted against installment accounts.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by document, name, OR, or sales order"
                className="h-10 bg-blue-50/60 pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-36 justify-between bg-white px-3 text-sm font-normal text-blue-950 hover:bg-white"
                >
                  <span>{statusFilterLabels[statusFilter]}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-(--radix-dropdown-menu-trigger-width)">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    const next = value as PaymentStatusFilter
                    setStatusFilter(next)
                    setPage(1)
                  }}
                >
                  {(Object.keys(statusFilterLabels) as PaymentStatusFilter[]).map((value) => (
                    <DropdownMenuRadioItem key={value} value={value} className="cursor-pointer">
                      {statusFilterLabels[value]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="action-hover h-10 bg-blue-500 px-3 text-white"
              disabled={loading}
              onClick={refresh}
            >
              <RefreshCw />
              Refresh
            </Button>
          </div>
        </div>
        <Table containerClassName="min-h-0 flex-1 overflow-auto">
          <TableHeader className="sticky top-0 z-20 bg-blue-50 text-blue-950">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column}
                  className={
                    column === "Actions"
                      ? "sticky right-0 z-30 h-11 bg-blue-50 px-5 text-xs font-semibold tracking-wide whitespace-nowrap text-blue-800 uppercase shadow-[-8px_0_12px_-8px_rgb(30_64_175_/_0.2)]"
                      : "h-11 bg-blue-50 px-5 text-xs font-semibold tracking-wide whitespace-nowrap text-blue-800 uppercase"
                  }
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="px-5">
                  <LoadingState />
                </TableCell>
              </TableRow>
            ) : error || payments.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="px-5 py-6 text-center">
                  <TableEmpty
                    label={
                      error ||
                      (search || statusFilter !== "all"
                        ? "No payments match that filter."
                        : "No payments are listed yet.")
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const edited = !payment.voided && !!payment.edited
                const rowTone = payment.voided
                  ? "bg-red-50"
                  : edited
                    ? "bg-amber-50"
                    : "bg-white"
                return (
                  <TableRow
                    key={payment.id}
                    className={
                      payment.voided
                        ? "bg-red-50/80 hover:bg-red-50"
                        : edited
                          ? "bg-amber-50/90 hover:bg-amber-100/80"
                          : "bg-white hover:bg-blue-50/70"
                    }
                  >
                    <TableCell className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            payment.voided
                              ? "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-red-700 ring-1 ring-red-200"
                              : edited
                                ? "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-900 ring-1 ring-amber-300"
                                : "inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-blue-800 ring-1 ring-blue-200"
                          }
                        >
                          {payment.documentNumber}
                        </span>
                        {edited ? (
                          <span className="inline-flex rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-950 uppercase ring-1 ring-amber-300">
                            Edited
                          </span>
                        ) : null}
                        {payment.voided ? (
                          <span className="inline-flex rounded-full bg-red-200/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-red-900 uppercase ring-1 ring-red-300">
                            Voided
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3 whitespace-nowrap text-blue-950/80">
                      {payment.date}
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-800 text-xs font-semibold text-white">
                          {initials(payment.name)}
                        </span>
                        <span className="font-medium text-blue-950">{payment.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-sky-800 ring-1 ring-sky-200">
                        {payment.orNumber || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-3 tabular-nums text-blue-950">
                      {peso.format(payment.maximumOfAmount)}
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-blue-800 ring-1 ring-blue-200">
                        {payment.minimumSalesOrderNumber || "—"}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`sticky right-0 z-10 px-5 py-3 whitespace-nowrap shadow-[-8px_0_12px_-8px_rgb(30_64_175_/_0.18)] ${rowTone}`}
                    >
                      <div className="inline-flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="shrink-0 cursor-pointer bg-white text-blue-700 hover:bg-blue-50"
                          aria-label={`View ${payment.documentNumber}`}
                          onClick={() => setViewing(payment)}
                        >
                          <Eye />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="shrink-0 cursor-pointer bg-white text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed"
                          aria-label={`Edit ${payment.documentNumber}`}
                          disabled={!!payment.voided}
                          onClick={() => {
                            if (payment.voided) return
                            setEditing(payment)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="shrink-0 cursor-pointer bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed"
                          aria-label={`Void ${payment.documentNumber}`}
                          disabled={!!payment.voided}
                          onClick={() => {
                            if (payment.voided) return
                            setVoiding(payment)
                          }}
                        >
                          <Ban />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <div className="shrink-0 border-t border-blue-100 bg-blue-50/50 px-4 py-3">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="Previous"
                  className={page <= 1 ? "pointer-events-none opacity-40" : "text-blue-950"}
                  onClick={(event) => {
                    event.preventDefault()
                    if (page > 1) setPage(page - 1)
                  }}
                />
              </PaginationItem>
              {pageNumbers(page, lastPage).map((item, index) => (
                <PaginationItem key={item === "ellipsis" ? `ellipsis-${index}` : item}>
                  {item === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={item === page}
                      className={
                        item === page
                          ? "bg-blue-800 text-white hover:bg-blue-800 hover:text-white"
                          : "text-blue-950"
                      }
                      onClick={(event) => {
                        event.preventDefault()
                        setPage(item)
                      }}
                    >
                      {item}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text="Next"
                  className={page >= lastPage ? "pointer-events-none opacity-40" : "text-blue-950"}
                  onClick={(event) => {
                    event.preventDefault()
                    if (page < lastPage) setPage(page + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
      <ViewPaymentModal
        open={viewing !== null}
        onOpenChangeAction={(open) => {
          if (!open) setViewing(null)
        }}
        payment={viewing}
      />
      <EditPaymentModal
        open={editing !== null}
        payment={editing}
        onOpenChangeAction={(open) => {
          if (!open) setEditing(null)
        }}
        onSavedAction={savePayment}
      />
      <VoidPaymentModal
        open={voiding !== null}
        payment={voiding}
        onOpenChangeAction={(open) => {
          if (!open) setVoiding(null)
        }}
        onVoidedAction={voidPayment}
      />
      <SuccessModal
        open={successNotice !== null}
        onOpenChangeAction={(open) => {
          if (!open) setSuccessNotice(null)
        }}
        title={successNotice?.title ?? ""}
        description={successNotice?.description ?? ""}
      />
      <ErrorModal
        open={errorNotice !== null}
        onOpenChangeAction={(open) => {
          if (!open) setErrorNotice(null)
        }}
        title={errorNotice?.title ?? ""}
        description={errorNotice?.description ?? ""}
      />
    </section>
  )
}
