import { ledgerCustomers, type LedgerCustomer } from "@/components/ledger-customers"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
})

function toAmount(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function CustomerSetupForm({
  customer = ledgerCustomers[0],
}: {
  customer?: LedgerCustomer
}) {
  const monthlyPrincipal =
    toAmount(customer.termMonths) > 0
      ? toAmount(customer.financedAmount) / toAmount(customer.termMonths)
      : 0
  const monthlyInterest = toAmount(customer.monthlyInterest)
  const monthlyInstallment =
    toAmount(customer.monthlyInstallment) || monthlyPrincipal + monthlyInterest

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-blue-200">
      <div className="shrink-0 bg-blue-800 px-5 py-2 text-white">
        <h2 className="text-lg font-semibold tracking-tight uppercase">{customer.customerName}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-6 pb-6">
          <Section title="Customer">
            <TextField
              label="Customer ID"
              id="customer-id"
              value={customer.customerId}
            />
          </Section>
          <Section title="Purchase">
            <TextField
              label="Sales order no."
              id="sales-order-no"
              value={customer.salesOrderNo}
            />
            <Field label="Date of purchase" htmlFor="date-of-purchase">
              <Input
                id="date-of-purchase"
                type="date"
                readOnly
                value={customer.loanStartDate}
                className="h-9 bg-white text-blue-950"
              />
            </Field>
            <TextField label="Location" id="location" value={customer.location} />
            <TextField
              label="Item class"
              id="item-class"
              value={customer.itemClass || customer.itemUnit}
            />
            <TextField label="Item / unit" id="item-unit" value={customer.itemUnit} />
            <MoneyField
              label="Rebate"
              id="rebate-amount"
              value={customer.rebateAmount}
            />
          </Section>
          <Section title="Amounts">
            <MoneyField label="Loan amount" id="loan-amount" value={customer.loanAmount} />
            <MoneyField
              label="Down payment"
              id="down-payment"
              value={customer.downPayment}
            />
            <Field label="Term (months)" htmlFor="term-months">
              <Input
                id="term-months"
                inputMode="numeric"
                readOnly
                value={customer.termMonths}
                className="h-9 bg-white text-blue-950 tabular-nums"
              />
            </Field>
            <MoneyField
              label="Financed amount"
              id="financed-amount"
              value={customer.financedAmount}
            />
          </Section>
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure label="Monthly principal" value={peso.format(monthlyPrincipal)} />
            <Figure label="Monthly interest" value={peso.format(monthlyInterest)} />
            <Figure label="Monthly installment" value={peso.format(monthlyInstallment)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-blue-800 uppercase">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className ? `flex flex-col gap-1.5 ${className}` : "flex flex-col gap-1.5"}>
      <Label htmlFor={htmlFor} className="text-xs text-blue-950">
        {label}
      </Label>
      {children}
    </div>
  )
}

function TextField({
  label,
  id,
  value,
  className,
}: {
  label: string
  id: string
  value: string
  className?: string
}) {
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input id={id} readOnly value={value} className="h-9 bg-white text-blue-950" />
    </Field>
  )
}

function MoneyField({
  label,
  id,
  value,
}: {
  label: string
  id: string
  value: string
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-sm text-muted-foreground">
          ₱
        </span>
        <Input
          id={id}
          readOnly
          value={value}
          className="h-9 bg-white pl-7 text-blue-950 tabular-nums"
        />
      </div>
    </Field>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
      <p className="text-xs font-medium text-blue-800">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-blue-950">{value}</p>
    </div>
  )
}
