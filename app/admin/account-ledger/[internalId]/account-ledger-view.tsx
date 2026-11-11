"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useParams } from "next/navigation"
import { BookOpen, Receipt, Search, UserRound, type LucideIcon } from "lucide-react"

import { CustomerSetupForm } from "@/components/customer-setup-form"
import { type LedgerCustomer } from "@/components/ledger-customers"
import { apiService, toApiErrorMessage } from "@/lib/apiService"
import { LoadingState } from "@/components/loading-state"
import { TableEmpty } from "@/components/table-empty"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Loan ledger has many columns; treat under this content width as too narrow. */
const COMPACT_TABLE_WIDTH = 1024

const loanLedgerColumns = [
  "Installment No.",
  "Due date",
  "Payment date",
  "Payment reference",
  "Monthly installment",
  "Monthly principal",
  "Monthly interest",
  "Penalty",
  "Rebate",
  "Monthly installment paid",
  "Monthly principal paid",
  "Monthly interest paid",
  "Penalty paid",
  "Overdue",
  "Running balance without penalty",
  "Running balance with penalty",
  "Payment breakdown",
]

const paymentHistoryColumns = [
  "Payment date",
  "OR / Ref no.",
  "Amount paid",
  "Penalty paid",
  "Applied to monthly due",
  "Unapplied excess",
  "Received by",
  "Location",
  "Remarks",
  "Validation / status",
  "Eligible for rebate",
]

const tabs = [
  "Customer set-up",
  "Loan Ledger",
  "Payment history",
] as const

type AccountLedgerTab = (typeof tabs)[number]

const tabMeta: Record<AccountLedgerTab, { icon: LucideIcon; hint: string }> = {
  "Customer set-up": {
    icon: UserRound,
    hint: "Customer and purchase details",
  },
  "Loan Ledger": {
    icon: BookOpen,
    hint: "Installment schedule and balances",
  },
  "Payment history": {
    icon: Receipt,
    hint: "Posted collections for this account",
  },
}

function tabLoadingVariant(tab: AccountLedgerTab): "table" | "fields" | "summary" {
  if (tab === "Loan Ledger") return "summary"
  if (tab === "Payment history") return "table"
  return "fields"
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
})

function loanSummary(customer: LedgerCustomer) {
  const principal =
    Number(customer.termMonths) > 0
      ? Number(customer.financedAmount) / Number(customer.termMonths)
      : 0
  const rebate =
    customer.rebateAmount !== "" && Number.isFinite(Number(customer.rebateAmount))
      ? peso.format(Number(customer.rebateAmount))
      : customer.rebateAmount
  return [
    [
      ["Date of purchase", customer.loanStartLabel || customer.purchaseDate],
      ["Location", customer.location],
      ["Item class", customer.itemClass || customer.itemUnit],
      ["Item / unit", customer.itemUnit],
      ["Sales order no.", customer.salesOrderNo],
    ],
    [
      ["Rebate", rebate],
      ["Term (months)", customer.termMonths],
      ["Original loan amount", peso.format(Number(customer.loanAmount))],
      ["Down payment", peso.format(Number(customer.downPayment))],
      ["Financed amount", peso.format(Number(customer.financedAmount))],
    ],
    [
      ["Monthly principal", peso.format(principal)],
      ["Monthly interest", peso.format(Number(customer.monthlyInterest))],
      ["Monthly installment", peso.format(principal + Number(customer.monthlyInterest))],
      ["Loan status", customer.loanStatus],
      ["Notes", customer.notes],
    ],
    [
      ["Current balance", peso.format(customer.currentBalance)],
      ["Total payments", peso.format(customer.totalPayments)],
      ["Total amount due", peso.format(customer.totalAmountDue)],
      ["Total balance due", peso.format(customer.totalBalanceDue)],
      ["Unrecovered cost", peso.format(customer.unrecoveredCost)],
    ],
  ]
}

function LoanLedgerSummary({
  title,
  customer,
}: {
  title: string
  customer: LedgerCustomer
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-blue-200">
      <div className="bg-blue-800 px-4 py-2 text-white sm:px-5 sm:py-4">
        <h2 className="text-sm font-semibold tracking-tight sm:text-base">{customer.customerName}</h2>
      </div>
      <div className="grid gap-4 px-4 py-4 sm:gap-6 sm:px-5 sm:py-5 md:grid-cols-2 xl:grid-cols-4">
        {loanSummary(customer).map((column, columnIndex) => (
          <dl key={`loan-summary-${columnIndex}`} className="flex min-w-0 flex-col gap-3">
            {column.map(([label, value], fieldIndex) => (
              <div
                key={`loan-summary-${columnIndex}-${fieldIndex}-${label}`}
                className="flex min-w-0 flex-col gap-1"
              >
                <dt className="text-xs font-medium text-blue-800">{label}</dt>
                <dd className="text-sm break-words text-blue-950">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </div>
  )
}

function RecordTable({
  columns,
  rows,
  empty,
}: {
  columns: readonly string[]
  rows: ReactNode[][]
  empty: string
}) {
  return (
    <div className="flex min-h-[18rem] w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-blue-200 sm:min-h-[22rem]">
      <Table containerClassName="min-h-0 max-w-full flex-1 overflow-auto">
        <TableHeader className="sticky top-0 z-10 bg-blue-50 text-blue-950">
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column}
                className="bg-blue-50 px-3 text-xs whitespace-nowrap text-blue-950 sm:px-4 sm:text-sm"
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="px-4 py-6 text-center">
                <TableEmpty label={empty} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={`ledger-row-${index}`}>
                {columns.map((column, cellIndex) => (
                  <TableCell
                    key={`ledger-cell-${index}-${cellIndex}-${column}`}
                    className="px-3 text-xs whitespace-nowrap sm:px-4 sm:text-sm"
                  >
                    {row[cellIndex] || "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function LedgerPanel({
  title,
  customer,
  columns,
  rows,
  empty,
}: {
  title: string
  customer: LedgerCustomer
  columns: readonly string[]
  rows: ReactNode[][]
  empty: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const viewportQuery = window.matchMedia("(max-width: 1023px)")

    const update = () => {
      const width = el.getBoundingClientRect().width
      // Small app window, or content column too tight for ~17 ledger columns.
      const compact =
        viewportQuery.matches || (width > 0 && width < COMPACT_TABLE_WIDTH)
      setNarrow(compact)
      if (!compact) setDrawerOpen(false)
    }

    update()
    viewportQuery.addEventListener("change", update)
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      viewportQuery.removeEventListener("change", update)
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto"
    >
      <div className="w-full min-w-0 shrink-0">
        <LoanLedgerSummary title={title} customer={customer} />
      </div>
      {narrow ? (
        <>
          <div className="flex shrink-0 flex-col gap-3 rounded-xl bg-white px-4 py-4 shadow-md ring-1 ring-blue-200 sm:px-5">
            <div>
              <p className="text-sm font-medium text-blue-950">Installment table</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This view is too narrow for all columns. Open the table to scroll them.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="action-hover w-fit bg-blue-800 text-white hover:bg-blue-900"
              onClick={() => setDrawerOpen(true)}
            >
              View installment table
            </Button>
          </div>
          <Drawer direction="bottom" open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent className="flex h-[90vh] max-h-[90vh] flex-col bg-white data-[vaul-drawer-direction=bottom]:mt-8 data-[vaul-drawer-direction=bottom]:max-h-[90vh]">
              <DrawerHeader className="shrink-0 border-b border-blue-100 text-left">
                <DrawerTitle className="text-blue-950">Loan ledger</DrawerTitle>
                <DrawerDescription>
                  Scroll sideways and up/down to review every installment column.
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pb-6">
                <RecordTable columns={columns} rows={rows} empty={empty} />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <RecordTable columns={columns} rows={rows} empty={empty} />
      )}
    </div>
  )
}

const purchaseDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function textOf(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

function locationOf(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (value && typeof value === "object") {
    const record = value as { location_name?: unknown; name?: unknown }
    return textOf(record.location_name) || textOf(record.name)
  }
  return ""
}

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return purchaseDate.format(date)
}

function money(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? peso.format(amount) : "—"
}

type LedgerLine = {
  installment_number?: unknown
  due_date?: unknown
  payment_date?: unknown
  payment_ref?: unknown
  penalty?: unknown
  rebate?: unknown
  rebate_amount?: unknown
  purchase_date?: unknown
  date_of_purchase?: unknown
  location?: unknown
  item_class?: unknown
  monthly_installment_paid?: unknown
  monthly_principal_paid?: unknown
  monthly_interest_paid?: unknown
  penalty_paid?: unknown
  overdue?: unknown
  balance_wo_penalty?: unknown
  balance_w_penalty?: unknown
  // Details for the Payment breakdown tooltip (from the compute endpoint)
  monthly_installment?: unknown
  penalty_accrued?: unknown
  unpaid?: unknown
  months_late_today?: unknown
  extra_months?: unknown
  extra_penalty?: unknown
  penalty_per_month?: unknown
  payment_breakdown?: unknown
}

/** One payment applied to one installment, with the numbers used to compute it. */
type BreakdownLine = {
  date?: unknown
  or_no?: unknown
  applied?: unknown
  principal?: unknown
  interest?: unknown
  penalty?: unknown
  rebate?: unknown
  unpaid_before?: unknown
  months_late?: unknown
  new_months?: unknown
  penalty_per_month?: unknown
  new_penalty?: unknown
  unpaid_after?: unknown
  payment_amount?: unknown
  cash_available?: unknown
  carried_from?: unknown
  cash_after?: unknown
}

/** One payment from the compute endpoint (payments table + calculator result). */
type PaymentLine = {
  payment_date?: unknown
  or_number?: unknown
  amount?: unknown
  penalty_paid?: unknown
  applied_to_monthly_due?: unknown
  unapplied_excess?: unknown
  received_by?: unknown
  remarks?: unknown
  status?: unknown
  isrebatable?: unknown
}

function BreakdownRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-blue-200">{label}</span>
      <span className="text-right font-medium text-white">{children}</span>
    </div>
  )
}

/**
 * Detailed calculation for one installment. For every payment that entered it:
 * amount paid -> (excess carried from the previous due) -> cash to apply -> penalty -> monthly -> unpaid / excess.
 */
function BreakdownDetails({ line }: { line: LedgerLine }) {
  const breakdown = Array.isArray(line.payment_breakdown) ? (line.payment_breakdown as BreakdownLine[]) : []
  const extraMonths = Number(line.extra_months) || 0
  const accrued = Number(line.penalty_accrued) || 0
  const totalPenaltyPaid = breakdown.reduce((sum, item) => sum + (Number(item.penalty) || 0), 0)
  const totalInterest = breakdown.reduce((sum, item) => sum + (Number(item.interest) || 0), 0)
  const totalPrincipal = breakdown.reduce((sum, item) => sum + (Number(item.principal) || 0), 0)

  return (
    <div className="flex flex-col gap-3 text-xs leading-snug">
      <p className="font-semibold text-white">
        Installment #{textOf(line.installment_number)} · due {formatDate(textOf(line.due_date))} ·{" "}
        {money(line.monthly_installment)}
      </p>

      {breakdown.length === 0 ? (
        <p className="text-blue-100">No payment has been applied to this installment yet.</p>
      ) : (
        breakdown.map((item, index) => {
          const newMonths = Number(item.new_months) || 0
          const carriedFrom = Number(item.carried_from) || 0
          const available = Number(item.cash_available) || 0
          const penaltyPaid = Number(item.penalty) || 0
          const interest = Number(item.interest) || 0
          const principal = Number(item.principal) || 0
          const rebate = Number(item.rebate) || 0
          const excess = Number(item.cash_after) || 0
          return (
            <div key={index} className="flex flex-col gap-1 rounded-md bg-white/10 p-2">
              <p className="font-semibold text-white">
                Payment {index + 1}
                {breakdown.length > 1 ? ` of ${breakdown.length}` : ""} · {formatDate(textOf(item.date))}
                {textOf(item.or_no) ? ` · ${textOf(item.or_no)}` : ""}
              </p>

              {carriedFrom > 0 ? (
                <BreakdownRow label={`Excess left after installment #${carriedFrom}`}>{money(available)}</BreakdownRow>
              ) : null}
              <BreakdownRow label="Cash to apply here">{money(available)}</BreakdownRow>

              <div className="mt-1 text-blue-100">
                Unpaid before: {money(item.unpaid_before)} · months late at payment date: {textOf(item.months_late) || "0"}
              </div>
              <div className="text-blue-100">
                {newMonths > 0
                  ? `New penalty: 4% of ${money(item.unpaid_before)} = ${money(item.penalty_per_month)}/month × ${newMonths} new month${newMonths > 1 ? "s" : ""} = ${money(item.new_penalty)}`
                  : "No new penalty (late months were already penalized)."}
              </div>

              <BreakdownRow label="1) Penalty paid first">{money(penaltyPaid)}</BreakdownRow>
              <div className="text-blue-100">Cash left after penalty: {money(available - penaltyPaid)}</div>
              <BreakdownRow label="2) Monthly paid">{money(interest + principal)}</BreakdownRow>
              <div className="text-blue-100">
                Interest {money(interest)} first, then principal {money(principal)}
                {rebate > 0 ? ` · includes rebate credit ${money(rebate)}` : ""}
              </div>

              <BreakdownRow label="Unpaid after this payment">{money(item.unpaid_after)}</BreakdownRow>
              {excess > 0 ? (
                <BreakdownRow label="Excess moves to the next due">{money(excess)}</BreakdownRow>
              ) : null}
            </div>
          )
        })
      )}

      <div className="flex flex-col gap-1 border-t border-white/20 pt-2">
        {breakdown.length > 1 ? (
          <div className="text-blue-100">
            All payments in this due: penalty {money(totalPenaltyPaid)} + interest {money(totalInterest)} + principal{" "}
            {money(totalPrincipal)}
          </div>
        ) : null}
        <BreakdownRow label="Penalty from payments">{money(accrued)}</BreakdownRow>
        {extraMonths > 0 ? (
          <div className="text-blue-100">
            + {extraMonths} more month{extraMonths > 1 ? "s" : ""} × {money(line.penalty_per_month)} (4% of the unpaid{" "}
            {money(line.unpaid)}) until today = {money(line.extra_penalty)}
          </div>
        ) : null}
        <BreakdownRow label="Total penalty">{money(line.penalty)}</BreakdownRow>
        <BreakdownRow label="Penalty paid">{money(line.penalty_paid)}</BreakdownRow>
        <BreakdownRow label="Overdue">{money(line.overdue)}</BreakdownRow>
      </div>
    </div>
  )
}

/**
 * Payment breakdown cell. Click opens a modal with the detailed calculation.
 * Modal content scrolls independently, so long breakdowns remain readable on any screen.
 */
function PaymentBreakdown({ line, summary }: { line: LedgerLine; summary: string }) {
  const count = Array.isArray(line.payment_breakdown) ? line.payment_breakdown.length : 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="cursor-pointer text-left underline decoration-dotted underline-offset-4 hover:text-blue-700"
          aria-label="Show payment breakdown details"
        >
          {summary}
          {count > 1 ? ` · ${count} payments` : ""}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="rounded-lg bg-blue-950 p-3">
            <BreakdownDetails line={line} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function readAccount(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const record = payload as {
    installment?: Record<string, unknown>
    account?: Record<string, unknown>
  }
  const account = record.installment ?? record.account
  if (!account) return null

  const purchaseRaw =
    textOf(account.purchase_date) ||
    textOf(account.date_of_purchase) ||
    textOf(account.loan_start_date)
  const locationName = locationOf(account.location)
  const itemClass = textOf(account.item_class)
  const itemUnit = textOf(account.item) || itemClass
  const rebateAmount = textOf(account.rebate_amount)
  const customer: LedgerCustomer = {
    internalId: textOf(account.internal_id),
    customerName: textOf(account.customer_name),
    customerId: textOf(account.customer_id) || textOf(account.internal_id),
    purchaseDate: formatDate(purchaseRaw),
    salesOrderNo: textOf(account.so_number) || textOf(account.sales_order_no),
    location: locationName,
    itemClass,
    itemUnit,
    loanStartDate: purchaseRaw.slice(0, 10),
    loanStartLabel: formatDate(purchaseRaw),
    loanAmount:
      textOf(account.total_accounts_receivable) ||
      textOf(account.loan_amount) ||
      textOf(account.financed_amount),
    downPayment: textOf(account.downpayment) || textOf(account.down_payment),
    termMonths: textOf(account.term),
    rebateAmount,
    financedAmount: textOf(account.financed_amount),
    monthlyInterest: textOf(account.monthly_interest),
    monthlyInstallment: textOf(account.monthly_installment),
    branchName: "",
    branchCode: "",
    preparedBy: "",
    approver: "",
    contactNo: "",
    templateVersion: "",
    loanStatus: textOf(account.loan_status) || "—",
    currentBalance: Number(account.current_balance) || 0,
    totalPayments: Number(account.total_payments) || 0,
    totalAmountDue: Number(account.total_amount_due) || 0,
    totalBalanceDue: Number(account.total_balance_due) || 0,
    unrecoveredCost: Number(account.unrecovered_cost) || 0,
    notes: "",
  }
  const lines = Array.isArray(account.installment_ledgers)
    ? (account.installment_ledgers as LedgerLine[])
    : Array.isArray(account.ledgers)
      ? (account.ledgers as LedgerLine[])
      : []
  const monthlyInstallment = textOf(account.monthly_installment)
  const monthlyPrincipal = textOf(account.monthly_principal)
  const monthlyInterest = textOf(account.monthly_interest)
  const rebated =
    Number(rebateAmount) > 0 ||
    account.is_rebated === true ||
    account.is_rebated === 1 ||
    textOf(account.is_rebated).toLowerCase() === "yes"
      ? "Yes"
      : "No"
  const ledgerRows = lines.map((line) => {
    const paid = [line.monthly_principal_paid, line.monthly_interest_paid, line.penalty_paid].some(
      (value) => Number(value) > 0,
    )
    const summary = paid
      ? `Principal ${money(line.monthly_principal_paid)} · Interest ${money(line.monthly_interest_paid)} · Penalty ${money(line.penalty_paid)}`
      : Number(line.penalty) > 0
        ? ""
        : ""
    // Tooltip with the detailed calculation (also for rows that only have a running penalty)
    const breakdown: ReactNode = summary ? <PaymentBreakdown line={line} summary={summary} /> : ""
    return [
      textOf(line.installment_number),
      formatDate(textOf(line.due_date)),
      formatDate(textOf(line.payment_date)),
      textOf(line.payment_ref),
      money(monthlyInstallment),
      money(monthlyPrincipal),
      money(monthlyInterest),
      money(line.penalty),
      money(line.rebate),
      money(line.monthly_installment_paid),
      money(line.monthly_principal_paid),
      money(line.monthly_interest_paid),
      money(line.penalty_paid),
      money(line.overdue),
      money(line.balance_wo_penalty),
      money(line.balance_w_penalty),
      breakdown,
    ]
  })
  const paymentLines = Array.isArray(account.payments) ? (account.payments as PaymentLine[]) : []
  const payments = paymentLines.map((payment) => [
    formatDate(textOf(payment.payment_date)),
    textOf(payment.or_number),
    money(payment.amount),
    money(payment.penalty_paid),
    money(payment.applied_to_monthly_due),
    money(payment.unapplied_excess),
    textOf(payment.received_by),
    locationName,
    textOf(payment.remarks),
    textOf(payment.status),
    payment.isrebatable === true || payment.isrebatable === 1 ? "Yes" : "No",
  ])
  return { id: textOf(account.id), customer, ledgerRows, payments }
}

type AccountMatch = {
  id: string
  internalId: string
  customerName: string
  purchaseDate: string
  salesOrderNo: string
  location: string
}

function readMatches(payload: unknown): AccountMatch[] {
  if (!payload || typeof payload !== "object") return []
  const accounts = (payload as { accounts?: { data?: unknown } | unknown[] }).accounts
  const list = Array.isArray(accounts)
    ? accounts
    : accounts && typeof accounts === "object" && Array.isArray(accounts.data)
      ? accounts.data
      : []
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const id = textOf(row.id)
    if (!id) return []
    return [{
      id,
      internalId: textOf(row.internal_id),
      customerName: textOf(row.customer_name),
      purchaseDate: formatDate(textOf(row.purchase_date)),
      salesOrderNo: textOf(row.so_number),
      location: locationOf(row.location),
    }]
  })
}

const resultColumns = ["Internal ID", "Customer name", "Date of purchase", "Sales order No.", "Location"]

export function AccountLedgerView({ searchable = false }: { searchable?: boolean }) {
  const params = useParams<{ internalId?: string }>()
  const routeId = typeof params.internalId === "string" ? decodeURIComponent(params.internalId) : ""
  const [tab, setTab] = useState<AccountLedgerTab>(tabs[0])
  const [tabLoading, setTabLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [resultsOpen, setResultsOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [matches, setMatches] = useState<AccountMatch[]>([])
  const [selected, setSelected] = useState<LedgerCustomer | null>(null)
  const [ledgerRows, setLedgerRows] = useState<ReactNode[][]>([])
  const [payments, setPayments] = useState<string[][]>([])
  const [accountKey, setAccountKey] = useState(routeId)
  const [loading, setLoading] = useState(Boolean(routeId))
  const [error, setError] = useState("")
  const skipSearch = useRef(false)
  const tabLoadId = useRef(0)

  function selectTab(next: AccountLedgerTab) {
    if (next === tab) return
    const loadId = tabLoadId.current + 1
    tabLoadId.current = loadId
    setTab(next)
    setTabLoading(true)
    window.setTimeout(() => {
      if (tabLoadId.current === loadId) setTabLoading(false)
    }, 280)
  }

  useEffect(() => {
    if (!accountKey) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        // Computed ledger (LedgerController@show): GET /api/ledger/{installment id}
        const data = await apiService.getLedger(accountKey)
        const next = readAccount(data)
        if (!cancelled) {
          if (!next) {
            setSelected(null)
            setLedgerRows([])
            setPayments([])
            setError("Account not found.")
          } else {
            setSelected(next.customer)
            setLedgerRows(next.ledgerRows)
            setPayments(next.payments)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelected(null)
          setLedgerRows([])
          setPayments([])
          setError(toApiErrorMessage(loadError, "That account could not be loaded."))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accountKey])

  useEffect(() => {
    if (!searchable) return
    if (skipSearch.current) {
      skipSearch.current = false
      return
    }
    const text = query.trim()
    if (text === "") {
      setSearchLoading(false)
      setResultsOpen(false)
      setMatches([])
      return
    }
    setResultsOpen(true)
    setSearchLoading(true)
    let cancelled = false
    const timer = window.setTimeout(() => {
      void apiService.getAccounts(1, text).then((data) => {
        if (cancelled) return
        setMatches(readMatches(data))
        setSearchLoading(false)
      }).catch((searchError) => {
        if (cancelled) return
        setMatches([])
        setSearchLoading(false)
        setError(toApiErrorMessage(searchError, "Accounts could not be searched."))
      })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchable])

  return (
    <section className="flex h-[calc(100svh-11.5rem)] min-h-0 flex-col gap-4 sm:h-[calc(100svh-12.5rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Account ledger sections"
          className="flex h-8 w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-blue-200 bg-blue-50/70 p-[3px] sm:w-auto"
        >
          {tabs.map((item) => {
            const selected = tab === item
            const Icon = tabMeta[item].icon
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={selected}
                title={tabMeta[item].hint}
                className={
                  selected
                    ? "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-blue-800 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-white"
                    : "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-blue-800 hover:bg-white"
                }
                onClick={() => selectTab(item)}
              >
                <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                <span>{item}</span>
              </button>
            )
          })}
        </div>
        {searchable ? (
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by customer name, customer ID, or sales order"
              className="h-8 bg-white pl-9 text-sm"
            />
          </div>
        ) : null}
      </div>
      <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <div role="tabpanel" className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        {loading || tabLoading ? (
          tab === "Payment history" ? (
            <div className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-blue-200">
              <LoadingState variant={tabLoadingVariant(tab)} />
            </div>
          ) : (
            <LoadingState variant={tabLoadingVariant(tab)} />
          )
        ) : error || !selected ? (
          <div className="flex min-h-80 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-blue-200">
            <TableEmpty label={error || "Search for an account."} />
          </div>
        ) : tab === "Customer set-up" ? (
          <CustomerSetupForm customer={selected} />
        ) : tab === "Loan Ledger" ? (
          <LedgerPanel
            title="Per customer loan ledger"
            customer={selected}
            columns={loanLedgerColumns}
            rows={ledgerRows}
            empty="No installments are listed yet."
          />
        ) : tab === "Payment history" ? (
          <RecordTable columns={paymentHistoryColumns} rows={payments} empty="No payments are listed yet." />
        ) : (
          <div className="rounded-xl bg-white px-6 py-8 shadow-md ring-1 ring-blue-200">
            <h2 className="text-lg font-semibold tracking-tight">{tab}</h2>
          </div>
        )}
      </div>
      {searchable && resultsOpen ? (
        <div className="absolute inset-0 z-10 overflow-auto rounded-xl bg-blue-50 p-4 shadow-md ring-1 ring-blue-200">
          {searchLoading ? (
          <div className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-blue-200">
            <Table>
              <TableHeader className="bg-blue-50 text-blue-950">
                <TableRow>
                  {resultColumns.map((column) => (
                    <TableHead key={column} className="px-4 text-blue-950">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={resultColumns.length} className="px-4">
                    <LoadingState />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          ) : matches.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-blue-200">
              <TableEmpty label="No customer matches that search." />
            </div>
          ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-blue-200">
            <Table>
              <TableHeader className="bg-blue-50 text-blue-950">
                <TableRow>
                  {resultColumns.map((column) => (
                    <TableHead key={column} className="px-4 text-blue-950">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((customer) => (
                    <TableRow
                      key={customer.id || `match-${customer.internalId}`}
                      className="cursor-pointer"
                      onClick={() => {
                        skipSearch.current = true
                        setAccountKey(customer.id)
                        setQuery(customer.customerName)
                        setSearchLoading(false)
                        setResultsOpen(false)
                      }}
                    >
                      <TableCell className="px-4">{customer.internalId}</TableCell>
                      <TableCell className="px-4">{customer.customerName}</TableCell>
                      <TableCell className="px-4">{customer.purchaseDate}</TableCell>
                      <TableCell className="px-4">{customer.salesOrderNo}</TableCell>
                      <TableCell className="px-4">{customer.location}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          )}
        </div>
      ) : null}
      </div>
    </section>
  )
}