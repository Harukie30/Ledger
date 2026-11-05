"use client"

import { useEffect, useRef, useState } from "react"
import { FileSpreadsheet, TriangleAlert } from "lucide-react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ModalError } from "@/components/modal-error"
import { ErrorModal, SuccessModal } from "@/components/status-modals"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { uploadRows, type UploadRow } from "@/lib/sheet-rows"
import { toApiErrorMessage } from "@/lib/apiService"

const maxFileBytes = 2 * 1024 * 1024

function isExcelFile(file: File) {
  const name = file.name.toLowerCase()
  return name.endsWith(".xls") || name.endsWith(".xlsx")
}

export const installmentColumns = [
  "Internal ID",
  "Customer name",
  "Sales Order No.",
  "Date of Purchase",
  "Principal Date",
  "Term",
  "Monthly installment",
  "Monthly principal",
  "Monthly interest",
  "Available amount",
  "Total accounts receivable",
  "Down Payment",
  "Financed amount",
  "Loan amount",
  "Location",
  "Item class",
  "Rebate amount",
]

export const paymentColumns = [
  "Document Number",
  "Date",
  "Name",
  "OR Number",
  "Maximum of Amount",
  "Memo (Main)",
  "Minimum of Sales Order Number - For DP",
  "Minimum of Invoice Number - Leasing",
  "Eligible For Rebate",
  "Generic Collector",
  "Location",
]

export function ExcelUploadModal({
  open,
  onOpenChangeAction,
  title,
  onUpload,
}: {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  title: string
  onUpload?: (rows: UploadRow[], fileName: string) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const progressTimer = useRef<number | null>(null)
  const uploadId = useRef(0)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState<{
    tone: "success" | "error"
    title: string
    description: string
  } | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)

  function stopProgress() {
    if (progressTimer.current === null) return
    window.clearInterval(progressTimer.current)
    progressTimer.current = null
  }

  useEffect(() => stopProgress, [])

  function clearFile() {
    uploadId.current += 1
    stopProgress()
    setFile(null)
    setError(null)
    setUploading(false)
    setProgress(0)
    setWarningOpen(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  function beginUpload() {
    if (!file || !onUpload) return
    const currentUpload = uploadId.current + 1
    uploadId.current = currentUpload
    setUploading(true)
    setProgress(8)
    setError(null)
    stopProgress()
    progressTimer.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current
        const step = current < 40 ? 7 : current < 70 ? 3 : 1
        return Math.min(90, current + step)
      })
    }, 160)
    void uploadRows(file, title)
      .then((rows) => onUpload(rows, file.name))
      .then(() => {
        if (uploadId.current !== currentUpload) return
        stopProgress()
        setProgress(100)
        setNotice({
          tone: "success",
          title: "Upload finished",
          description: `${title} was uploaded.`,
        })
        handleOpenChange(false)
      })
      .catch((uploadError: unknown) => {
        if (uploadId.current !== currentUpload) return
        stopProgress()
        setUploading(false)
        setProgress(0)
        setNotice({
          tone: "error",
          title: "Upload did not finish",
          description: toApiErrorMessage(uploadError, "That file could not be uploaded."),
        })
        handleOpenChange(false)
      })
  }

  function showSizeExceeded() {
    setWarningOpen(false)
    setNotice({
      tone: "error",
      title: "File exceeds 2MB",
      description:
        "Upload stopped. Choose an Excel file that is 2MB or smaller, then try again.",
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) clearFile()
    onOpenChangeAction(next)
  }

  function chooseFile(selected: File | undefined) {
    if (!selected) {
      setFile(null)
      return
    }
    if (!isExcelFile(selected)) {
      setFile(null)
      setError({
        title: "Wrong file type",
        message: "Choose a spreadsheet that ends in .xls or .xlsx.",
      })
      if (inputRef.current) inputRef.current.value = ""
      return
    }
    setError(null)
    setFile(selected)
  }

  return (
    <>
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="w-[min(32rem,calc(100%-2rem))] max-w-none! gap-0 overflow-hidden p-0 shadow-lg ring-blue-200 sm:max-w-none!">
        <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-6 py-4 text-white">
          <AlertDialogTitle className="text-lg">Upload {title}</AlertDialogTitle>
          <AlertDialogDescription className="text-blue-100">
            Choose the Excel file for this {title.toLowerCase()} upload.
          </AlertDialogDescription>
        </div>
        <form
          className="flex flex-col gap-4 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!file) {
              setError({
                title: "No file selected",
                message: "Choose an Excel file, then upload it.",
              })
              return
            }
            if (!onUpload) return
            setWarningOpen(true)
          }}
        >
          <label
            className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center ${
              uploading ? "pointer-events-none" : "cursor-pointer"
            } ${
              error
                ? "border-red-300 bg-red-50/70"
                : "border-blue-300 bg-blue-50"
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-800 to-sky-500 text-white">
              <FileSpreadsheet className="size-5" />
            </span>
            <span className="text-sm font-semibold text-blue-950">
              {file ? file.name : "Choose an Excel file"}
            </span>
            <span className="text-xs text-muted-foreground">.xls or .xlsx</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </label>
          {uploading ? (
            <div className="flex flex-col gap-2">
              <Progress
                value={progress}
                aria-label="Uploading file"
                className="h-2 bg-blue-100 **:data-[slot=progress-indicator]:bg-blue-700"
              />
              <p className="text-xs font-medium text-blue-800 tabular-nums">
                Uploading {Math.round(progress)}% 
              </p>
            </div>
          ) : null}
          {error ? <ModalError title={error.title} message={error.message} /> : null}
          <div className="flex justify-end gap-2 border-t border-blue-100 pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-red-500  text-white cursor-pointer shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-red-600 hover:text-white hover:shadow-md px-4"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-blue-800 px-3 text-white cursor-pointer shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-blue-900 hover:text-white hover:shadow-md"
              disabled={!file || uploading}
            >
              {uploading ? "Uploading" : "Upload"}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
      <AlertDialogContent className="w-[min(28rem,calc(100%-2rem))] max-w-none! gap-0 overflow-hidden p-0 shadow-lg ring-amber-200 sm:max-w-none!">
        <div className="flex flex-col items-center gap-3 bg-amber-500 px-6 py-7 text-center text-white">
          <span className="flex size-12 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
            <TriangleAlert className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-wide uppercase">Warning</p>
            <AlertDialogTitle className="text-lg text-white">Check the file size</AlertDialogTitle>
            <AlertDialogDescription className="text-amber-50">
              The Excel file must not exceed 2MB. Continue only if this file is within that size.
            </AlertDialogDescription>
          </div>
        </div>
        <div className="flex justify-end gap-2 bg-white px-6 py-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer bg-white px-4 text-blue-950"
            onClick={() => setWarningOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer bg-amber-500 px-3 text-white hover:bg-amber-600"
            onClick={() => {
              if (file && file.size > maxFileBytes) {
                showSizeExceeded()
                return
              }
              setWarningOpen(false)
              beginUpload()
            }}
          >
            Continue
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    <SuccessModal
      open={notice?.tone === "success"}
      onOpenChangeAction={(next) => {
        if (!next) setNotice(null)
      }}
      title={notice?.tone === "success" ? notice.title : "Upload finished"}
      description={notice?.tone === "success" ? notice.description : ""}
      durationMs={3000}
    />
    <ErrorModal
      open={notice?.tone === "error"}
      onOpenChangeAction={(next) => {
        if (!next) setNotice(null)
      }}
      title={notice?.tone === "error" ? notice.title : "Upload did not finish"}
      description={notice?.tone === "error" ? notice.description : ""}
      durationMs={3500}
    />
    </>
  )
}
