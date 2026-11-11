"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export type SelectionOption = {
  value: string
  label: string
}

export function SelectionCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  emptyLabel = "No options found.",
  loading = false,
  disabled = false,
  className,
}: {
  options: SelectionOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  loading?: boolean
  disabled?: boolean
  className?: string
}) {
  const labels = options.map((option) => option.label)
  const selected = options.find((option) => option.value === value || option.label === value)
  const selectedLabel = selected?.label ?? (value || null)

  return (
    <Combobox
      items={labels}
      value={selectedLabel}
      onValueChange={(next) => {
        if (next == null || next === "") {
          onValueChange("")
          return
        }
        const match = options.find((option) => option.label === next || option.value === next)
        onValueChange(match?.value ?? next)
      }}
      disabled={disabled || loading}
    >
      <ComboboxInput
        placeholder={loading ? "Loading…" : placeholder}
        disabled={disabled || loading}
        className={className ?? "h-10 w-full bg-white"}
        showClear={Boolean(selectedLabel)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={String(item)} value={String(item)}>
              {String(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function textOf(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function listFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []
  const record = payload as Record<string, unknown>
  for (const key of ["data", "selections", "locations", "sos", "SOs", "items", "options"]) {
    const value = record[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
      return (value as { data: unknown[] }).data
    }
  }
  return []
}

export function readSelectionOptions(
  payload: unknown,
  preferredKeys: string[] = ["name", "label", "so_number", "location_name", "code"],
): SelectionOption[] {
  const seen = new Set<string>()
  return listFromPayload(payload).flatMap((item, index) => {
    if (typeof item === "string" || typeof item === "number") {
      const label = String(item).trim()
      if (!label || seen.has(label)) return []
      seen.add(label)
      return [{ value: label, label }]
    }
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const label =
      preferredKeys.map((key) => textOf(row[key])).find(Boolean) ||
      textOf(row.title) ||
      textOf(row.value) ||
      textOf(row.id)
    if (!label) return []
    const value = textOf(row.id) || textOf(row.value) || label
    const key = `${value}::${label}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ value: value || `option-${index}`, label }]
  })
}
