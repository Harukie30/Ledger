import { readXlsxGrid } from "@/lib/xlsx-grid"

export type UploadRow = Record<string, string | number | null>

const installmentHeaders: Record<string, string> = {
  "internal id": "internal_id",
  "customer name": "customer_name",
  "sales order no.": "sales_order_no",
  "sales order no": "sales_order_no",
  "date of purchase": "date_of_purchase",
  "purchase date": "date_of_purchase",
  purchase_date: "date_of_purchase",
  date_of_purchase: "date_of_purchase",
  "principal date": "principal_date",
  term: "term",
  "monthly installment": "monthly_installment",
  "monthly principal": "monthly_principal",
  "monthly interest": "monthly_interest",
  "available amount": "available_amount",
  "total accounts receivable": "total_accounts_receivable",
  "down payment": "down_payment",
  "financed amount": "financed_amount",
  "loan amount": "loan_amount",
  loan: "loan_amount",
  location: "location",
  "location name": "location",
  "first due date": "first_due_date",
  first_due_date: "first_due_date",
  "is rebated": "is_rebated",
  is_rebated: "is_rebated",
  rebated: "is_rebated",
  rebate: "rebate_amount",
  item: "item",
  "item unit": "item",
  "item class": "item_class",
  item_class: "item_class",
  "rebate amount": "rebate_amount",
  rebate_amount: "rebate_amount",
}

const paymentHeaders: Record<string, string> = {
  "document number": "document_number",
  date: "date",
  name: "name",
  "or number": "or_number",
  "maximum of amount": "maximum_of_amount",
  "memo (main)": "memo_main",
  "minimum of sales order number - for dp": "minimum_sales_order_number_for_dp",
  "minimum of invoice number - leasing": "minimum_invoice_number_leasing",
  "eligible for rebate": "eligible_for_rebate",
  "generic collector": "generic_collector",
  location: "location",
}

const installmentDates = new Set(["date_of_purchase", "principal_date", "first_due_date"])
const installmentAmounts = new Set([
  "monthly_installment",
  "monthly_principal",
  "monthly_interest",
  "available_amount",
  "total_accounts_receivable",
  "down_payment",
  "financed_amount",
  "loan_amount",
  "rebate_amount",
])

export async function uploadRows(file: File, title: string): Promise<UploadRow[]> {
  if (title === "Payment") {
    return mapRows(await readXlsxGrid(file), paymentHeaders, ["document_number", "name"], "payment")
  }
  return mapRows(await readXlsxGrid(file), installmentHeaders, ["internal_id", "customer_name"], "installment")
}

function mapRows(
  grid: (string | null)[][],
  headers: Record<string, string>,
  required: string[],
  kind: "installment" | "payment",
): UploadRow[] {
  if (grid.length === 0) return []
  const columns = new Map<number, string>()
  grid[0].forEach((header, index) => {
    const key = headers[label(header)]
    if (key) columns.set(index, key)
  })
  const names = [...columns.values()]
  if (required.some((key) => !names.includes(key))) {
    throw new Error(
      kind === "payment"
        ? "The sheet needs Document Number and Name columns."
        : "The sheet needs Internal ID and Customer name columns.",
    )
  }

  const rows: UploadRow[] = []
  for (const line of grid.slice(1)) {
    const row: UploadRow = {}
    for (const [index, key] of columns) row[key] = cast(kind, key, line[index] ?? null)
    if (required.every((key) => row[key] == null || row[key] === "")) continue
    rows.push(row)
  }
  if (rows.length === 0) {
    throw new Error(kind === "payment" ? "The sheet has no payment rows." : "The sheet has no installment rows.")
  }
  return rows
}

function label(value: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function cast(kind: "installment" | "payment", key: string, value: string | null): string | number | null {
  const text = value?.trim() ?? ""
  if (!text) return null
  const dates = kind === "payment" ? key === "date" : installmentDates.has(key)
  if (dates) return excelDate(text)
  if (kind === "installment" && key === "is_rebated") {
    const answer = text.toLowerCase()
    if (["yes", "y", "true", "1"].includes(answer)) return 1
    if (["no", "n", "false", "0"].includes(answer)) return 0
    return text
  }
  if (kind === "installment" && key === "term") return Number.parseInt(text, 10)
  const amount = kind === "payment" ? key === "maximum_of_amount" : installmentAmounts.has(key)
  if (amount) {
    const number = text.replace(/[^\d.-]/g, "")
    return number ? number : null
  }
  return text
}

function excelDate(value: string) {
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const days = Math.trunc(Number(value))
    const date = new Date(Date.UTC(1899, 11, 30))
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${parsed.getFullYear()}-${month}-${day}`
}
