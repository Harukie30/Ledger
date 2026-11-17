import type { LedgerCustomer } from "@/components/ledger-customers"

export type PrintAmortRow = {
  installmentNo: string
  dueDate: string
  paymentDate: string
  paymentReference: string
  monthlyInstallment: string
  penalty: string
  rebate: string
  balanceWithoutPenalty: string
  balanceWithPenalty: string
}

export type PrintLedgerDoc = {
  companyName: string
  formTitle: string
  customerName: string
  soNumber: string
  itemUnit: string
  itemClass: string
  termMonths: string
  loanStartDate: string
  originalLoanAmount: string
  totalBalance: string
  location: string
  rows: PrintAmortRow[]
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function printMoney(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ""
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function printDate(value: string) {
  const text = value.trim()
  if (!text || text === "—") return ""
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text
  const iso = text.slice(0, 10)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`)
    : new Date(text)
  if (Number.isNaN(date.getTime())) return text
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

function textOf(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function termLabel(value: string) {
  const digits = value.replace(/\D/g, "")
  if (!digits) return value
  return digits.padStart(3, "0")
}

export function buildPrintLedgerDoc(
  customer: LedgerCustomer,
  rows: PrintAmortRow[],
  firstDueDate?: string,
): PrintLedgerDoc {
  const location = customer.location || ""
  const dueFromRows = rows.find((row) => row.dueDate)?.dueDate || ""
  return {
    companyName: "DES Strong Motors, Inc.",
    formTitle: `Installment Inquiry Form - Amortization Ledger${location ? ` - ${location}` : ""}`,
    customerName: customer.customerName || "",
    soNumber: customer.salesOrderNo || "",
    itemUnit: customer.itemUnit || "",
    itemClass: customer.itemClass || "",
    termMonths: termLabel(customer.termMonths || ""),
    loanStartDate: printDate(firstDueDate || dueFromRows),
    originalLoanAmount: printMoney(customer.loanAmount),
    totalBalance: printMoney(customer.totalBalanceDue || customer.currentBalance),
    location,
    rows,
  }
}

function padInstallmentNo(value: unknown) {
  const text = textOf(value)
  if (!text) return ""
  const upper = text.toUpperCase()
  if (upper === "DP" || upper === "DOWN PAYMENT") return "DP"
  const digits = text.replace(/\D/g, "")
  if (!digits) return text
  return digits.padStart(3, "0")
}

export function buildPrintAmortRows(
  lines: Array<{
    installment_number?: unknown
    due_date?: unknown
    payment_date?: unknown
    payment_ref?: unknown
    monthly_installment?: unknown
    rebate?: unknown
    penalty?: unknown
    balance_wo_penalty?: unknown
    balance_w_penalty?: unknown
    payment_breakdown?: unknown
  }>,
  monthlyInstallment: string,
): PrintAmortRow[] {
  return lines.map((line) => {
    const breakdown = Array.isArray(line.payment_breakdown)
      ? (line.payment_breakdown as Array<{ date?: unknown; or_no?: unknown }>)
      : []
    const paymentDates = breakdown
      .map((item) => printDate(textOf(item.date)))
      .filter(Boolean)
    const paymentRefs = breakdown.map((item) => textOf(item.or_no)).filter(Boolean)

    const installment =
      line.monthly_installment != null && textOf(line.monthly_installment) !== ""
        ? printMoney(line.monthly_installment)
        : printMoney(monthlyInstallment)

    return {
      installmentNo: padInstallmentNo(line.installment_number),
      dueDate: printDate(textOf(line.due_date)),
      paymentDate:
        (paymentDates.length ? paymentDates : [printDate(textOf(line.payment_date))])
          .filter(Boolean)
          .join(", "),
      paymentReference:
        (paymentRefs.length ? paymentRefs : [textOf(line.payment_ref)])
          .filter(Boolean)
          .join(", "),
      monthlyInstallment: installment,
      penalty: printMoney(line.penalty) || "0.00",
      rebate: Number(line.rebate) > 0 ? printMoney(line.rebate) : "0.00",
      balanceWithoutPenalty: printMoney(line.balance_wo_penalty) || "0.00",
      balanceWithPenalty: printMoney(line.balance_w_penalty) || "0.00",
    }
  })
}

function metaRow(label: string, value: string) {
  return `<tr><td class="label">${escapeHtml(label)}</td><td class="colon">:</td><td class="value">${escapeHtml(value)}</td></tr>`
}

export function printLoanLedger(doc: PrintLedgerDoc) {
  const rowsHtml = doc.rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.installmentNo || "")}</td>
        <td>${escapeHtml(row.dueDate || "")}</td>
        <td class="wrap">${escapeHtml(row.paymentDate || "")}</td>
        <td class="wrap">${escapeHtml(row.paymentReference || "")}</td>
        <td class="num">${escapeHtml(row.monthlyInstallment || "")}</td>
        <td class="num">${escapeHtml(row.penalty || "")}</td>
        <td class="num">${escapeHtml(row.rebate || "")}</td>
        <td class="num">${escapeHtml(row.balanceWithoutPenalty || "")}</td>
        <td class="num">${escapeHtml(row.balanceWithPenalty || "")}</td>
      </tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.formTitle)}</title>
  <style>
    @page { size: landscape; margin: 0.35in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
      font-family: "Times New Roman", Times, serif;
      font-size: 9.5pt;
      line-height: 1.15;
    }
    .sheet {
      width: 100%;
      min-height: 100%;
    }
    .company {
      text-align: center;
      font-size: 16pt;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .form-title {
      font-size: 10.5pt;
      font-weight: 700;
      margin: 0 0 6px;
    }
    .rule {
      border: 0;
      border-top: 1px solid #000;
      margin: 4px 0 8px;
    }
    .meta {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .meta td {
      vertical-align: top;
      width: 50%;
      padding: 0;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table .label {
      width: 9.5rem;
      white-space: nowrap;
      font-weight: 700;
      padding: 0 4px 1px 0;
      text-transform: uppercase;
      font-size: 8.5pt;
    }
    .meta-table .colon {
      width: 0.6rem;
      padding: 0 2px 1px 0;
      font-weight: 700;
    }
    .meta-table .value {
      padding: 0 0 1px;
      font-size: 8.5pt;
    }
    .ledger {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .ledger col.c-no { width: 7%; }
    .ledger col.c-due { width: 8%; }
    .ledger col.c-paid { width: 8%; }
    .ledger col.c-ref { width: 14%; }
    .ledger col.c-inst { width: 10%; }
    .ledger col.c-pen { width: 8%; }
    .ledger col.c-reb { width: 8%; }
    .ledger col.c-bal1 { width: 18.5%; }
    .ledger col.c-bal2 { width: 18.5%; }
    .ledger th, .ledger td {
      border: 0;
      padding: 2px 4px;
      vertical-align: top;
      font-size: 8pt;
      text-align: left;
      overflow: hidden;
    }
    .ledger thead th {
      font-weight: 700;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      vertical-align: bottom;
      line-height: 1.1;
      white-space: normal;
      word-break: normal;
      overflow-wrap: anywhere;
    }
    .ledger thead th.num,
    .ledger tbody td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .ledger tbody td {
      border-bottom: 0;
    }
    .ledger .wrap {
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    @media print {
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { page-break-inside: avoid; }
      .ledger, .ledger tr, .ledger td, .ledger th { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1 class="company">${escapeHtml(doc.companyName)}</h1>
    <p class="form-title">${escapeHtml(doc.formTitle)}</p>
    <hr class="rule" />
    <table class="meta">
      <tr>
        <td>
          <table class="meta-table">
            ${metaRow("CUSTOMER NAME", doc.customerName)}
            ${metaRow("SO NUMBER", doc.soNumber)}
            ${metaRow("ITEM/UNIT", doc.itemUnit)}
            ${metaRow("ITEM CLASS", doc.itemClass)}
          </table>
        </td>
        <td>
          <table class="meta-table">
            ${metaRow("TERM (MONTHS)", doc.termMonths)}
            ${metaRow("LOAN START DATE", doc.loanStartDate)}
            ${metaRow("ORIGINAL LOAN AMOUNT", doc.originalLoanAmount)}
            ${metaRow("TOTAL BALANCE", doc.totalBalance)}
          </table>
        </td>
      </tr>
    </table>
    <hr class="rule" />
    <table class="ledger">
      <colgroup>
        <col class="c-no" />
        <col class="c-due" />
        <col class="c-paid" />
        <col class="c-ref" />
        <col class="c-inst" />
        <col class="c-pen" />
        <col class="c-reb" />
        <col class="c-bal1" />
        <col class="c-bal2" />
      </colgroup>
      <thead>
        <tr>
          <th>Installment<br/>No.</th>
          <th>Due Date</th>
          <th>Payment Date</th>
          <th>Payment Reference</th>
          <th class="num">Monthly<br/>Installment</th>
          <th class="num">Penalty</th>
          <th class="num">Rebate</th>
          <th class="num">Running Balance<br/>w/o Penalty</th>
          <th class="num">Running Balance<br/>w/ Penalty</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="9">No installment rows.</td></tr>`}
      </tbody>
    </table>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`

  const popup = window.open("", "_blank")
  if (!popup) return false
  popup.opener = null
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  return true
}
