"use client"

import { useEffect, useState } from "react"
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react"

import { AddUserModal } from "@/components/add-user-modal"
import { BranchCodeCombobox } from "@/components/branch-code-combobox"
import { ModalError } from "@/components/modal-error"
import { SuccessModal } from "@/components/status-modals"
import { TableEmpty } from "@/components/table-empty"
import { UpdateUserModal } from "@/components/update-user-modal"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/loading-state"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { apiService, toApiErrorMessage } from "@/lib/apiService"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const columns = ["Name", "Email", "Code", "Branch code", "Actions"]

type ListedUser = {
  id?: string | number
  name?: string
  fname?: string
  lname?: string
  email?: string
  code?: string
  branch_code?: string
  created_at?: string
  updated_at?: string
}

type UpdateTone = "new" | "recent" | null

const NEW_UPDATE_MS = 24 * 60 * 60 * 1000
const RECENT_UPDATE_MS = 7 * 24 * 60 * 60 * 1000

function parseWhen(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function updateTone(user: ListedUser): UpdateTone {
  const updated = parseWhen(user.updated_at)
  if (!updated) return null
  const created = parseWhen(user.created_at)
  const wasEdited =
    !created || Math.abs(updated.getTime() - created.getTime()) > 60_000
  if (!wasEdited) return null
  const age = Date.now() - updated.getTime()
  if (age < 0) return "new"
  if (age <= NEW_UPDATE_MS) return "new"
  if (age <= RECENT_UPDATE_MS) return "recent"
  return null
}

const pageSize = 10

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

function readUserPage(payload: unknown) {
  const users = listedUsers(payload)
  const record = payload && typeof payload === "object" ? (payload as { users?: { current_page?: number; last_page?: number } }) : null
  const pager = record?.users && typeof record.users === "object" ? record.users : null
  const currentPage = pager?.current_page ?? 1
  const lastPage = pager?.last_page && pager.last_page > 0 ? pager.last_page : Math.max(1, Math.ceil(users.length / pageSize))
  const pageUsers = users.length > pageSize ? users.slice((currentPage - 1) * pageSize, currentPage * pageSize) : users
  return { users: pageUsers, currentPage, lastPage }
}

function listedUsers(payload: unknown): ListedUser[] {
  if (!payload || typeof payload !== "object") return []
  const record = payload as {
    data?: unknown
    users?: { data?: unknown } | unknown[]
  }
  const paged =
    record.users && typeof record.users === "object" && !Array.isArray(record.users)
      ? record.users.data
      : undefined
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(paged)
      ? paged
      : Array.isArray(record.users)
        ? record.users
        : Array.isArray(record.data)
          ? record.data
          : []
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as ListedUser & Record<string, unknown>
    return [
      {
        ...row,
        created_at:
          typeof row.created_at === "string"
            ? row.created_at
            : typeof row.createdAt === "string"
              ? row.createdAt
              : undefined,
        updated_at:
          typeof row.updated_at === "string"
            ? row.updated_at
            : typeof row.updatedAt === "string"
              ? row.updatedAt
              : undefined,
      },
    ]
  })
}

function listedBranches(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return []
  const list = (payload as { branch_code?: unknown }).branch_code
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const code = (item as { branch_code?: unknown }).branch_code
    if (typeof code !== "string" || !code.trim()) return []
    return [code.trim()]
  })
}

function displayName(user: ListedUser) {
  const name = user.name?.trim() || [user.fname, user.lname].filter(Boolean).join(" ")
  return name || "—"
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter((part) => part && part !== "—")
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || "?"
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [users, setUsers] = useState<ListedUser[]>([])
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [branch, setBranch] = useState("")
  const [branches, setBranches] = useState<string[]>([])
  const [editing, setEditing] = useState<ListedUser | null>(null)
  const [adding, setAdding] = useState(false)
  const [deletingUser, setDeletingUser] = useState<ListedUser | null>(null)
  const [leavingId, setLeavingId] = useState<string | number | null>(null)
  const [removing, setRemoving] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [error, setError] = useState("")
  const [successNotice, setSuccessNotice] = useState<{
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
        const data = await apiService.getUsers(page, {
          search,
          branch_code: branch,
        })
        if (!cancelled) {
          const next = readUserPage(data)
          const nextBranches = listedBranches(data)
          setUsers(next.users)
          setBranches((current) => (nextBranches.length > 0 ? nextBranches : current))
          setPage(next.currentPage)
          setLastPage(next.lastPage)
        }
      } catch (loadError) {
        if (!cancelled) {
          setUsers([])
          setError(toApiErrorMessage(loadError, "Users could not be loaded."))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadKey, search, branch])

  function refresh() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function removeUser() {
    if (deletingUser?.id == null) return
    setRemoving(true)
    setDeleteError("")
    try {
      const removedId = deletingUser.id
      const removedName =
        deletingUser.name?.trim() ||
        [deletingUser.fname, deletingUser.lname].filter(Boolean).join(" ").trim() ||
        "User"
      await apiService.deleteUser(removedId)
      setDeletingUser(null)
      setLeavingId(removedId)
      setSuccessNotice({
        title: "User deleted",
        description: `${removedName} was removed from the ledger.`,
      })
      window.setTimeout(() => {
        setUsers((current) => current.filter((user) => user.id !== removedId))
        setLeavingId(null)
        setReloadKey((key) => key + 1)
      }, 700)
    } catch (failure) {
      setDeleteError(toApiErrorMessage(failure, "That user could not be deleted."))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section className="flex h-[calc(100svh-11.5rem)] min-h-0 flex-col sm:h-[calc(100svh-12.5rem)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-blue-200">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-blue-100 px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-blue-950">Users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              People who can sign in to the ledger.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-blue-900/70">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-400 ring-1 ring-amber-500/40" />
                New update (24h)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-blue-500 ring-1 ring-blue-600/30" />
                Recent update (7d)
              </span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, code, or branch code"
                className="h-10 bg-blue-50/60 pl-9"
              />
            </div>
            <BranchCodeCombobox
              branches={branches}
              value={branch}
              allLabel="All branches"
              placeholder="All branches"
              className="h-10 min-w-44 justify-between bg-blue-50/60 px-3 text-sm font-normal text-blue-950 hover:bg-blue-50/60"
              onValueChange={(value) => {
                setBranch(value)
                setPage(1)
              }}
            />
            <Button
              type="button"
              size="sm"
              className="action-hover h-10 bg-blue-800 px-3 text-white cursor-pointer"
              onClick={() => setAdding(true)}
            >
              <Plus />
              Add user
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="action-hover h-10 bg-blue-800 px-3 text-white cursor-pointer"
              disabled={loading}
              onClick={refresh}
            >
              <RefreshCw />
              Refresh
            </Button>
          </div>
        </div>
        <Table containerClassName="min-h-0 flex-1 overflow-y-auto">
          <TableHeader className="sticky top-0 z-10 bg-blue-50 text-blue-950">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column}
                  className="h-11 bg-blue-50 px-5 text-xs font-semibold tracking-wide text-blue-800 uppercase"
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
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="px-5 py-6 text-center">
                  <TableEmpty label={error} />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="px-5 py-6 text-center">
                  <TableEmpty
                    label={
                      search || branch
                        ? "No users match that filter."
                        : "No users are listed yet."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const name = displayName(user)
                const leaving = leavingId != null && user.id === leavingId
                const tone = updateTone(user)
                const rowTone =
                  tone === "new"
                    ? "bg-amber-50/90 hover:bg-amber-100/80"
                    : tone === "recent"
                      ? "bg-blue-50/80 hover:bg-blue-100/80"
                      : "bg-white hover:bg-blue-50/70"
                return (
                  <TableRow
                    key={user.id ?? user.email}
                    className={
                      leaving
                        ? "pointer-events-none animate-user-remove"
                        : rowTone
                    }
                  >
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-800 text-xs font-semibold text-white">
                          {initials(name)}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-blue-950">{name}</span>
                          {tone ? (
                            <span
                              className={
                                tone === "new"
                                  ? "mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 ring-1 ring-amber-200 uppercase"
                                  : "mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-800 ring-1 ring-blue-200 uppercase"
                              }
                            >
                              {tone === "new" ? "New update" : "Recent update"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-blue-950/80">{user.email || "—"}</TableCell>
                    <TableCell className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-blue-800 ring-1 ring-blue-200">
                        {user.code || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-sky-800 ring-1 ring-sky-200">
                        {user.branch_code || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="action-hover bg-white text-blue-700 cursor-pointer"
                          aria-label={`Edit ${name}`}
                          disabled={user.id == null}
                          onClick={() => setEditing(user)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="action-hover bg-white text-red-600 cursor-pointer"
                          aria-label={`Delete ${name}`}
                          disabled={user.id == null}
                          onClick={() => {
                            setDeleteError("")
                            setDeletingUser(user)
                          }}
                        >
                          <Trash2 />
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
                      ? "border-blue-800 bg-blue-800 text-white hover:bg-blue-900 hover:text-white"
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
      <AlertDialog
        open={deletingUser !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setDeletingUser(null)
        }}
      >
        <AlertDialogContent className="w-[min(28rem,calc(100%-2rem))] max-w-none! gap-0 overflow-hidden p-0 shadow-lg ring-blue-200 sm:max-w-none!">
          <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 px-6 py-5 text-white">
            <AlertDialogTitle className="text-xl font-semibold">Delete this user?</AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm text-blue-100">
              Their sign-in will be removed. This cannot be undone.
            </AlertDialogDescription>
          </div>
          {deletingUser ? (
            <div className="px-6 py-5">
              <p className="text-lg font-semibold text-blue-950">{displayName(deletingUser)}</p>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium text-blue-950">{deletingUser.email || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Code</dt>
                  <dd className="font-medium text-blue-950">{deletingUser.code || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Branch code</dt>
                  <dd className="font-medium text-blue-950">{deletingUser.branch_code || "—"}</dd>
                </div>
              </dl>
              {deleteError ? (
                <div className="mt-4">
                  <ModalError title="This user was not deleted" message={deleteError} />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-blue-100 bg-blue-50 px-6 py-4">
            <AlertDialogCancel className="bg-white px-4" disabled={removing}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              className="bg-red-600 px-4 text-white hover:bg-red-700"
              disabled={removing || deletingUser?.id == null}
              onClick={() => void removeUser()}
            >
              {removing ? "Deleting" : "Delete user"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <AddUserModal
        open={adding}
        branches={branches}
        onOpenChangeAction={setAdding}
        onAddedAction={() => {
          setPage(1)
          refresh()
        }}
      />
      <UpdateUserModal
        open={editing !== null}
        user={editing}
        branches={branches}
        onOpenChangeAction={(open) => {
          if (!open) setEditing(null)
        }}
        onUpdatedAction={() => {
          refresh()
          setSuccessNotice({
            title: "User updated",
            description: "The account details were saved.",
          })
        }}
      />
      <SuccessModal
        open={successNotice !== null}
        onOpenChangeAction={(open) => {
          if (!open) setSuccessNotice(null)
        }}
        title={successNotice?.title ?? ""}
        description={successNotice?.description ?? ""}
      />
    </section>
  )
}
