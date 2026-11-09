export type LedgerCustomer = {
  internalId: string
  customerName: string
  customerId: string
  purchaseDate: string
  salesOrderNo: string
  location: string
  itemClass: string
  itemUnit: string
  loanStartDate: string
  loanStartLabel: string
  loanAmount: string
  downPayment: string
  termMonths: string
  rebateAmount: string
  financedAmount: string
  monthlyInterest: string
  monthlyInstallment: string
  branchName: string
  branchCode: string
  preparedBy: string
  approver: string
  contactNo: string
  templateVersion: string
  loanStatus: string
  currentBalance: number
  totalPayments: number
  totalAmountDue: number
  totalBalanceDue: number
  unrecoveredCost: number
  notes: string
}

/** Body for PUT /installments/:id from customer set-up fields. */
export function installmentAccountPayload(customer: LedgerCustomer) {
  return {
    internal_id: customer.internalId,
    customer_name: customer.customerName,
    customer_id: customer.customerId,
    date_of_purchase: customer.loanStartDate || null,
    purchase_date: customer.loanStartDate || null,
    sales_order_no: customer.salesOrderNo,
    location: customer.location,
    item_class: customer.itemClass,
    item: customer.itemUnit,
    loan_amount: customer.loanAmount,
    down_payment: customer.downPayment,
    term: customer.termMonths,
    rebate_amount: customer.rebateAmount,
    financed_amount: customer.financedAmount,
    monthly_interest: customer.monthlyInterest,
    monthly_installment: customer.monthlyInstallment,
  }
}

export const ledgerCustomers: LedgerCustomer[] = [
  {
    internalId: "ACC-1002",
    customerName: "Sample Customer",
    customerId: "CUST-001",
    purchaseDate: "Apr 3, 2026",
    salesOrderNo: "SO-0001",
    location: "Bohol",
    itemClass: "Motorcycle",
    itemUnit: "Smash 115",
    loanStartDate: "2026-04-03",
    loanStartLabel: "Apr 3, 2026",
    loanAmount: "242268",
    downPayment: "15000",
    termMonths: "36",
    rebateAmount: "300",
    financedAmount: "135000",
    monthlyInterest: "2563",
    monthlyInstallment: "3750",
    branchName: "",
    branchCode: "",
    preparedBy: "",
    approver: "",
    contactNo: "",
    templateVersion: "Branch Production v1",
    loanStatus: "Fully paid",
    currentBalance: 0,
    totalPayments: 32028,
    totalAmountDue: 13120,
    totalBalanceDue: 0,
    unrecoveredCost: 116473,
    notes: "",
  },
  {
    internalId: "ACC-1001",
    customerName: "Maria Santos",
    customerId: "CUST-014",
    purchaseDate: "Oct 14, 2026",
    salesOrderNo: "SO-24081",
    location: "Cebu",
    itemClass: "Motorcycle",
    itemUnit: "Honda Click 125",
    loanStartDate: "2026-10-14",
    loanStartLabel: "Oct 14, 2026",
    loanAmount: "98000",
    downPayment: "8000",
    termMonths: "24",
    rebateAmount: "150",
    financedAmount: "90000",
    monthlyInterest: "1200",
    monthlyInstallment: "3750",
    branchName: "Alano",
    branchCode: "ALAD",
    preparedBy: "",
    approver: "",
    contactNo: "",
    templateVersion: "Branch Production v1",
    loanStatus: "Current",
    currentBalance: 54000,
    totalPayments: 36000,
    totalAmountDue: 90000,
    totalBalanceDue: 54000,
    unrecoveredCost: 42000,
    notes: "",
  },
]

export function matchesCustomer(customer: LedgerCustomer, query: string) {
  const text = query.trim().toLowerCase()
  if (!text) return false
  return [
    customer.internalId,
    customer.customerName,
    customer.customerId,
    customer.salesOrderNo,
    customer.location,
    customer.itemClass,
    customer.itemUnit,
  ].some((value) => value.toLowerCase().includes(text))
}
