"use client"

import { useEffect, useState, type FormEvent } from "react"

import { LoadingState } from "@/components/loading-state"
import { ModalError } from "@/components/modal-error"
import { ModalLogoWatermark } from "@/components/modal-logo-watermark"
import {
  readSelectionOptions,
  type SelectionOption,
} from "@/components/selection-combobox"
import type { ViewPayment } from "@/components/view-payment-modal"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { apiService, toApiErrorMessage } from "@/lib/apiService"
import { ChevronDown } from "lucide-react"

function YesNoDropdown({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  const selected =
    value.trim().toLowerCase() === "yes"
      ? "Yes"
      : value.trim().toLowerCase() === "no"
        ? "No"
        : ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-between bg-white px-3 text-sm font-normal text-blue-950 hover:bg-white"
        >
          <span className={selected ? "text-blue-950" : "text-muted-foreground"}>
            {selected || "Select Yes or No"}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup value={selected} onValueChange={onValueChange}>
          <DropdownMenuRadioItem value="Yes" className="cursor-pointer">
            Yes
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="No" className="cursor-pointer">
            No
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function withCurrentOption(options: SelectionOption[], current: string) {
  const text = current.trim()
  if (!text) return options
  if (options.some((option) => option.value === text || option.label === text)) return options
  return [{ value: text, label: text }, ...options]
}

function SelectionDropdown({
  options,
  value,
  onValueChange,
  placeholder,
  emptyLabel,
  loading = false,
}: {
  options: SelectionOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  emptyLabel: string
  loading?: boolean
}) {
  const items = withCurrentOption(options, value)
  const selected = items.find((option) => option.value === value || option.label === value)
  const selectedLabel = selected?.label ?? value.trim()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          className="h-10 w-full justify-between bg-white px-3 text-sm font-normal text-blue-950 hover:bg-white"
        >
          <span
            className={
              selectedLabel
                ? "truncate text-blue-950"
                : "truncate text-muted-foreground"
            }
          >
            {loading ? "Loading…" : selectedLabel || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-(--radix-dropdown-menu-trigger-width)">
        {items.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <DropdownMenuRadioGroup
            value={selected?.value ?? value}
            onValueChange={onValueChange}
          >
            {items.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="cursor-pointer"
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EditPaymentModal({
  open,
  payment,
  onOpenChangeAction,
  onSavedAction,
}: {
  open: boolean
  payment: ViewPayment | null
  onOpenChangeAction: (open: boolean) => void
  onSavedAction: (payment: ViewPayment, remarks: string) => void | Promise<void>
}) {
  const [documentNumber, setDocumentNumber] = useState("")
  const [date, setDate] = useState("")
  const [name, setName] = useState("")
  const [orNumber, setOrNumber] = useState("")
  const [maximumOfAmount, setMaximumOfAmount] = useState("")
  const [memoMain, setMemoMain] = useState("")
  const [installmentId, setInstallmentId] = useState("")
  const [minimumInvoiceNumberLeasing, setMinimumInvoiceNumberLeasing] = useState("")
  const [eligibleForRebate, setEligibleForRebate] = useState("")
  const [genericCollector, setGenericCollector] = useState("")
  const [locationId, setLocationId] = useState("")
  const [remarks, setRemarks] = useState("")
  const [salesOrders, setSalesOrders] = useState<SelectionOption[]>([])
  const [locations, setLocations] = useState<SelectionOption[]>([])
  const [selectionsLoading, setSelectionsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const currentInstallmentId = payment?.installmentId != null ? String(payment.installmentId) : ""
  const currentLocationId = payment?.locationId != null ? String(payment.locationId) : ""

  const hasChanges =
    !!payment &&
    (documentNumber.trim() !== payment.documentNumber.trim() ||
      date.trim() !== payment.date.trim() ||
      name.trim() !== payment.name.trim() ||
      orNumber.trim() !== payment.orNumber.trim() ||
      maximumOfAmount.trim() !== String(payment.maximumOfAmount) ||
      memoMain.trim() !== payment.memoMain.trim() ||
      installmentId !== currentInstallmentId ||
      minimumInvoiceNumberLeasing.trim() !==
        payment.minimumInvoiceNumberLeasing.trim() ||
      eligibleForRebate.trim() !== payment.eligibleForRebate.trim() ||
      genericCollector.trim() !== payment.genericCollector.trim() ||
      locationId !== currentLocationId)

  useEffect(() => {
    if (!hasChanges && remarks) setRemarks("")
  }, [hasChanges, remarks])

  useEffect(() => {
    if (!open || !payment) return
    let cancelled = false
    setDocumentNumber(payment.documentNumber)
    setDate(payment.date)
    setName(payment.name)
    setOrNumber(payment.orNumber)
    setMaximumOfAmount(String(payment.maximumOfAmount))
    setMemoMain(payment.memoMain)
    setInstallmentId(payment.installmentId != null ? String(payment.installmentId) : "")
    setMinimumInvoiceNumberLeasing(payment.minimumInvoiceNumberLeasing)
    setEligibleForRebate(payment.eligibleForRebate)
    setGenericCollector(payment.genericCollector)
    setLocationId(payment.locationId != null ? String(payment.locationId) : "")
    setRemarks("")
    setError("")
    setSaving(false)
    setLoading(true)
    setSelectionsLoading(true)
    const timer = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 400)

    void Promise.all([
      apiService.getSalesOrderSelections(),
      apiService.getLocationSelections(),
    ])
      .then(([soPayload, locationPayload]) => {
        if (cancelled) return
        const nextSalesOrders = readSelectionOptions(soPayload, [
          "so_number",
          "sales_order_no",
          "sales_order_number",
          "number",
          "name",
          "label",
          "code",
        ])
        const nextLocations = readSelectionOptions(locationPayload, [
          "location_name",
          "name",
          "label",
          "code",
          "branch_code",
        ])
        setSalesOrders(nextSalesOrders)
        setLocations(nextLocations)

        if (payment.installmentId == null && payment.minimumSalesOrderNumber) {
          const match = nextSalesOrders.find(
            (option) =>
              option.label === payment.minimumSalesOrderNumber ||
              option.value === payment.minimumSalesOrderNumber,
          )
          if (match) setInstallmentId(match.value)
        }
        if (payment.locationId == null && payment.location) {
          const match = nextLocations.find(
            (option) => option.label === payment.location || option.value === payment.location,
          )
          if (match) setLocationId(match.value)
        }
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(
          toApiErrorMessage(loadError, "Sales order and location options could not be loaded."),
        )
      })
      .finally(() => {
        if (!cancelled) setSelectionsLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, payment])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!payment) return
    const nextName = name.trim()
    const nextDocument = documentNumber.trim()
    const nextRemarks = remarks.trim()
    const amount = Number(maximumOfAmount)
    const nextInstallmentId = Number(installmentId)
    const nextLocationId = Number(locationId)
    if (!nextDocument || !nextName || !Number.isFinite(amount)) {
      setError("Fill in the document number, name, and a valid amount.")
      return
    }
    if (!Number.isFinite(nextInstallmentId) || nextInstallmentId <= 0) {
      setError("Select a sales order.")
      return
    }
    if (!Number.isFinite(nextLocationId) || nextLocationId <= 0) {
      setError("Select a location.")
      return
    }
    if (!hasChanges) {
      setError("Change at least one field before saving.")
      return
    }
    if (!nextRemarks) {
      setError("Add remarks before saving your changes.")
      return
    }
    const selectedSalesOrder = salesOrders.find(
      (option) => option.value === installmentId || option.label === installmentId,
    )
    const selectedLocation = locations.find(
      (option) => option.value === locationId || option.label === locationId,
    )
    setSaving(true)
    setError("")
    try {
      await onSavedAction(
        {
          ...payment,
          documentNumber: nextDocument,
          date: date.trim(),
          name: nextName,
          orNumber: orNumber.trim(),
          maximumOfAmount: amount,
          memoMain: memoMain.trim(),
          minimumSalesOrderNumber:
            selectedSalesOrder?.label || payment.minimumSalesOrderNumber,
          minimumInvoiceNumberLeasing: minimumInvoiceNumberLeasing.trim(),
          eligibleForRebate: eligibleForRebate.trim(),
          genericCollector: genericCollector.trim(),
          location: selectedLocation?.label || payment.location,
          installmentId: nextInstallmentId,
          locationId: nextLocationId,
        },
        nextRemarks,
      )
      onOpenChangeAction(false)
    } catch (saveError) {
      setError(toApiErrorMessage(saveError, "This payment could not be saved."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChangeAction}>
      <AlertDialogContent className="w-[min(48rem,calc(100%-2rem))] max-w-none! gap-0 overflow-hidden p-0 shadow-lg ring-blue-200 sm:max-w-none!">
        <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-6 py-5 text-white">
          <AlertDialogTitle className="text-xl">
            {payment?.documentNumber || "Edit payment"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-blue-100">
            Update this payment record.
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
              <div className="grid max-h-[min(36rem,60svh)] min-h-0 gap-x-4 gap-y-3 overflow-y-auto px-6 py-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">Document number</span>
                  <Input
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">Date</span>
                  <Input
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-blue-950">Name</span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">OR number</span>
                  <Input
                    value={orNumber}
                    onChange={(event) => setOrNumber(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">Maximum of amount</span>
                  <Input
                    inputMode="decimal"
                    value={maximumOfAmount}
                    onChange={(event) => setMaximumOfAmount(event.target.value)}
                    className="h-10 bg-white text-blue-950 tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-blue-950">Memo (main)</span>
                  <Input
                    value={memoMain}
                    onChange={(event) => setMemoMain(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">
                    Minimum of sales order number
                  </span>
                  <SelectionDropdown
                    options={salesOrders}
                    value={installmentId}
                    onValueChange={setInstallmentId}
                    placeholder="Select a sales order"
                    emptyLabel="No sales orders found."
                    loading={selectionsLoading}
                  />
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">
                    Minimum of invoice number - leasing
                  </span>
                  <Input
                    value={minimumInvoiceNumberLeasing}
                    onChange={(event) => setMinimumInvoiceNumberLeasing(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">Eligible for rebate</span>
                  <YesNoDropdown value={eligibleForRebate} onValueChange={setEligibleForRebate} />
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-blue-950">Generic collector</span>
                  <Input
                    value={genericCollector}
                    onChange={(event) => setGenericCollector(event.target.value)}
                    className="h-10 bg-white text-blue-950"
                  />
                </label>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-blue-950">Location</span>
                  <SelectionDropdown
                    options={locations}
                    value={locationId}
                    onValueChange={setLocationId}
                    placeholder="Select a location"
                    emptyLabel="No locations found."
                    loading={selectionsLoading}
                  />
                </div>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-blue-950">Remarks</span>
                  <Textarea
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    disabled={!hasChanges}
                    placeholder={
                      hasChanges
                        ? "Describe why this payment is being updated"
                        : "Make a change to enable remarks"
                    }
                    className="min-h-24 bg-white text-blue-950 disabled:bg-blue-50/60"
                  />
                </label>
                {error ? (
                  <div className="sm:col-span-2">
                    <ModalError title="This payment was not saved" message={error} />
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 border-t border-blue-100 bg-blue-50/80 px-6 py-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer bg-white px-4 text-blue-950"
                  disabled={saving}
                  onClick={() => onOpenChangeAction(false)}
                >
                  Cancel
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          type="submit"
                          size="sm"
                          className="cursor-pointer bg-blue-800 px-3 text-white hover:bg-blue-900"
                          disabled={saving || !payment || !hasChanges || !remarks.trim()}
                        >
                          {saving ? "Saving" : "Save"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {saving || !payment || !hasChanges || !remarks.trim() ? (
                      <TooltipContent side="top">
                        {!payment || saving
                          ? "Saving is unavailable right now"
                          : !hasChanges
                            ? "Make a change before saving"
                            : "Add remarks before saving"}
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </form>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
