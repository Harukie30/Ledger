import type { LedgerCustomer } from "@/components/ledger-customers"

export type PrintAmortRow = {
  amortNum: string
  dateDue: string
  transNum: string
  datePaid: string
  prinAmort: string
  pmtApplied: string
  rebate: string
  penalty: string
}

export type PrintLedgerDoc = {
  companyName: string
  formTitle: string
  name: string
  branch: string
  contactNum: string
  billingAddress: string
  engineNum: string
  chassisNum: string
  productDesc: string
  productCode: string
  salesAgent: string
  siNum: string
  lcpAmount: string
  term: string
  dateRelease: string
  paymentType: string
  total: string
  balance: string
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
  if (!text) return ""
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

function padAmort(value: unknown) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
  if (!text) return ""
  const upper = text.toUpperCase()
  if (upper === "DP" || upper === "DOWN PAYMENT") return "DP"
  const digits = text.replace(/\D/g, "")
  if (!digits) return text
  return digits.padStart(3, "0")
}

function termLabel(value: string) {
  const digits = value.replace(/\D/g, "")
  if (!digits) return value
  return digits.padStart(3, "0")
}

export function buildPrintLedgerDoc(
  customer: LedgerCustomer,
  rows: PrintAmortRow[],
  extras?: Partial<PrintLedgerDoc>,
): PrintLedgerDoc {
  const branch = extras?.branch || customer.location || ""
  const name = [customer.customerId, customer.customerName].filter(Boolean).join(" ").trim()
  return {
    companyName: extras?.companyName || "DES Strong Motors, Inc.",
    formTitle:
      extras?.formTitle ||
      `Installment Inquiry Form - Amortization Ledger - ${branch || customer.location || "Branch"}`,
    name: extras?.name || name,
    branch,
    contactNum: extras?.contactNum || customer.contactNo || "",
    billingAddress: extras?.billingAddress || "",
    engineNum: extras?.engineNum || "",
    chassisNum: extras?.chassisNum || "",
    productDesc: extras?.productDesc || customer.itemUnit || customer.itemClass || "",
    productCode: extras?.productCode || "",
    salesAgent: extras?.salesAgent || "",
    siNum:
      extras?.siNum ||
      (customer.salesOrderNo ? `Sales Order #${customer.salesOrderNo}` : ""),
    lcpAmount: extras?.lcpAmount || printMoney(customer.financedAmount || customer.loanAmount),
    term: extras?.term || termLabel(customer.termMonths),
    dateRelease: extras?.dateRelease || printDate(customer.loanStartDate || customer.purchaseDate),
    paymentType: extras?.paymentType || "",
    total: extras?.total || printMoney(customer.totalAmountDue || customer.loanAmount),
    balance: extras?.balance || printMoney(customer.totalBalanceDue || customer.currentBalance),
    rows,
  }
}

export function buildPrintAmortRows(
  lines: Array<{
    installment_number?: unknown
    due_date?: unknown
    payment_date?: unknown
    payment_ref?: unknown
    monthly_installment?: unknown
    monthly_installment_paid?: unknown
    rebate?: unknown
    penalty?: unknown
    payment_breakdown?: unknown
  }>,
  monthlyInstallment: string,
): PrintAmortRow[] {
  return lines.map((line) => {
    const breakdown = Array.isArray(line.payment_breakdown)
      ? (line.payment_breakdown as Array<{
          date?: unknown
          or_no?: unknown
          rebate?: unknown
          principal?: unknown
          interest?: unknown
        }>)
      : []
    const transParts = breakdown
      .map((item) =>
        typeof item.or_no === "string" || typeof item.or_no === "number"
          ? String(item.or_no).trim()
          : "",
      )
      .filter(Boolean)
    const dateParts = breakdown
      .map((item) =>
        typeof item.date === "string" || typeof item.date === "number"
          ? printDate(String(item.date))
          : "",
      )
      .filter(Boolean)
    const rebateParts = breakdown
      .map((item) => {
        const rebate =
          typeof item.rebate === "string" || typeof item.rebate === "number"
            ? String(item.rebate).trim()
            : ""
        return rebate
      })
      .filter((value) => value && value !== "0" && value !== "0.00")

    const fallbackRef =
      typeof line.payment_ref === "string" || typeof line.payment_ref === "number"
        ? String(line.payment_ref).trim()
        : ""
    const fallbackDate =
      typeof line.payment_date === "string" || typeof line.payment_date === "number"
        ? printDate(String(line.payment_date))
        : ""

    const prin =
      line.monthly_installment != null && line.monthly_installment !== ""
        ? printMoney(line.monthly_installment)
        : printMoney(monthlyInstallment)

    return {
      amortNum: padAmort(line.installment_number),
      dateDue: printDate(
        typeof line.due_date === "string" || typeof line.due_date === "number"
          ? String(line.due_date)
          : "",
      ),
      transNum: (transParts.length ? transParts : fallbackRef ? [fallbackRef] : []).join(", "),
      datePaid: (dateParts.length ? dateParts : fallbackDate ? [fallbackDate] : []).join(", "),
      prinAmort: prin,
      pmtApplied: printMoney(line.monthly_installment_paid) || "0",
      rebate:
        rebateParts.join(", ") ||
        (Number(line.rebate) > 0 ? printMoney(line.rebate) : ""),
      penalty: printMoney(line.penalty) || "0",
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
        <td>${escapeHtml(row.amortNum)}</td>
        <td>${escapeHtml(row.dateDue)}</td>
        <td class="wrap">${escapeHtml(row.transNum)}</td>
        <td class="wrap">${escapeHtml(row.datePaid)}</td>
        <td class="num">${escapeHtml(row.prinAmort)}</td>
        <td class="num">${escapeHtml(row.pmtApplied)}</td>
        <td class="wrap">${escapeHtml(row.rebate)}</td>
        <td class="num">${escapeHtml(row.penalty)}</td>
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
      width: 7.5rem;
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
    .ledger th, .ledger td {
      border: 0;
      padding: 1px 3px;
      vertical-align: top;
      font-size: 8pt;
      text-align: left;
    }
    .ledger thead th {
      font-weight: 700;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      white-space: nowrap;
    }
    .ledger tbody td {
      border-bottom: 0;
    }
    .ledger .num { text-align: right; white-space: nowrap; }
    .ledger .wrap { word-break: break-word; }
    .ledger th:nth-child(1), .ledger td:nth-child(1) { width: 6%; }
    .ledger th:nth-child(2), .ledger td:nth-child(2) { width: 8%; }
    .ledger th:nth-child(3), .ledger td:nth-child(3) { width: 28%; }
    .ledger th:nth-child(4), .ledger td:nth-child(4) { width: 12%; }
    .ledger th:nth-child(5), .ledger td:nth-child(5) { width: 10%; }
    .ledger th:nth-child(6), .ledger td:nth-child(6) { width: 10%; }
    .ledger th:nth-child(7), .ledger td:nth-child(7) { width: 14%; }
    .ledger th:nth-child(8), .ledger td:nth-child(8) { width: 12%; }
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
            ${metaRow("NAME", doc.name)}
            ${metaRow("BRANCH", doc.branch)}
            ${metaRow("CONTACT NUM", doc.contactNum)}
            ${metaRow("BILLING ADDRESS", doc.billingAddress)}
            ${metaRow("ENGINE NUM", doc.engineNum)}
            ${metaRow("CHASSIS NUM", doc.chassisNum)}
            ${metaRow("PRODUCT DESC", doc.productDesc)}
            ${metaRow("PRODUCT CODE", doc.productCode)}
            ${metaRow("SALES AGENT", doc.salesAgent)}
          </table>
        </td>
        <td>
          <table class="meta-table">
            ${metaRow("SI NUM", doc.siNum)}
            ${metaRow("LCP AMOUNT", doc.lcpAmount)}
            ${metaRow("TERM", doc.term)}
            ${metaRow("DATE RELEASE", doc.dateRelease)}
            ${metaRow("PAYMENT TYPE", doc.paymentType)}
            ${metaRow("TOTAL", doc.total)}
            ${metaRow("BALANCE", doc.balance)}
          </table>
        </td>
      </tr>
    </table>
    <hr class="rule" />
    <table class="ledger">
      <thead>
        <tr>
          <th>Amort Num</th>
          <th>Date Due</th>
          <th>Trans Num</th>
          <th>Date Paid</th>
          <th>Prin Amort</th>
          <th>Pmt Applied</th>
          <th>Rebate</th>
          <th>Penalty/ PastDue Interest</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="8">No installment rows.</td></tr>`}
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

  // Avoid "noopener" in window.open features — some browsers then return null
  // even when the print tab opens, which made the app treat print as failed.
  const popup = window.open("", "_blank")
  if (!popup) return false
  popup.opener = null
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  return true
}
