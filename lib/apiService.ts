import { api, sanctum } from "./api";
import type { UploadRow } from "./sheet-rows";

export function toApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    // Backend may only expose POST /installments until GET list exists — don't surface that.
    if (response?.status === 405) {
      return "";
    }
    const data = response?.data;
    if (typeof data === "string" && data.trim() !== "") {
      const text = data.trim();
      if (/method is not supported/i.test(text)) return "";
      return text;
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.error;
      if (typeof message === "string" && message.trim() !== "") {
        const text = message.trim();
        if (/method is not supported/i.test(text)) return "";
        return text;
      }
    }
  }
  if (error instanceof Error && error.message.trim() !== "") {
    const text = error.message.trim();
    if (/method is not supported/i.test(text)) return "";
    return text;
  }
  return fallback;
}

export const sanctum_csrf = async () => {
  try {
    await sanctum.get("/sanctum/csrf-cookie");
  } catch (error) {
    console.error("Failed to get CSRF cookie:", error);
    throw error;
  }
};

function compactRows(rows: UploadRow[]): UploadRow[] {
  return rows.map((row) => {
    const compact: UploadRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (value == null || value === "") continue;
      compact[key] = value;
    }
    return compact;
  });
}

async function postRows(
  path: string,
  rows: UploadRow[],
  message: string,
  fileName?: string,
): Promise<unknown> {
  const body: { rows: UploadRow[]; file_name?: string } = {
    rows: compactRows(rows),
  };
  const name = fileName?.trim();
  if (name) body.file_name = name;
  const response = await api.post(path, body, {
    headers: { "Content-Type": "application/json" },
  });
  const count = response.data?.inserted;
  return {
    message,
    inserted: typeof count === "number" ? count : rows.length,
  };
}

export const apiService = {
  login: async (email: string, password: string): Promise<unknown> => {
    await sanctum_csrf();
    const response = await api.post("/login", { email, password });
    return response.data;
  },

  authUser: async (): Promise<unknown> => {
    const response = await api.get("/profile");
    return response.data;
  },

  logout: async (): Promise<unknown> => {
    const response = await api.post("/logout");
    return response.data;
  },

// ADMIN USER API :
  getUsers: async (
    page = 1,
    filters?: { search?: string; branch_code?: string },
  ): Promise<unknown> => {
    const params: { page: number; per_page: number; search?: string; branch_code?: string } = {
      page,
      per_page: 10,
    };
    const search = filters?.search?.trim();
    const branchCode = filters?.branch_code?.trim();
    if (search) params.search = search;
    if (branchCode) params.branch_code = branchCode;
    const response = await api.get("/users", { params });
    return response.data;
  },

  getUser: async (user: string | number): Promise<unknown> => {
    const response = await api.get(`/users/${user}`);
    return response.data;
  },

  addUser: async (payload: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post("/users", payload);
    return response.data;
  },

  updateUser: async (user: string | number, payload: Record<string, unknown>): Promise<unknown> => {
    const response = await api.put(`/users/${user}`, payload);
    return response.data;
  },

  deleteUser: async (user: string | number): Promise<unknown> => {
    const response = await api.delete(`/users/${user}`);
    return response.data;
  },
  
// ADMIN ACCOUNT API :
  getAccounts: async (page = 1, search?: string): Promise<unknown> => {
    const params: { page: number; per_page: number; search?: string } = {
      page,
      per_page: 10,
    };
    const text = search?.trim();
    if (text) params.search = text;
    const response = await api.get("/installments", { params });
    return response.data;
  },

  getAccount: async (account: string | number): Promise<unknown> => {
    const response = await api.get(`/installments/${encodeURIComponent(String(account))}`);
    return response.data;
  },

  updateAccount: async (
    account: string | number,
    payload: Record<string, unknown>,
  ): Promise<unknown> => {
    const response = await api.put(
      `/installments/${encodeURIComponent(String(account))}`,
      payload,
    );
    return response.data;
  },

// ADMIN ACTIVITY LOGS API :
  // Initial list: GET /logs. Live rows: Echo private channel (see lib/echo.ts).
  getActivityLogs: async (
    page = 1,
    filters?: { search?: string; area?: string },
  ): Promise<unknown> => {
    const params: { page: number; per_page: number; search?: string; area?: string } = {
      page,
      per_page: 10,
    };
    const search = filters?.search?.trim();
    const area = filters?.area?.trim();
    if (search) params.search = search;
    if (area && area.toLowerCase() !== "all") params.area = area;
    const response = await api.get("/logs", { params });
    return response.data;
  },

// ADMIN BRANCH / LOCATION API :
  getLocations: async (page = 1, search?: string): Promise<unknown> => {
    const params: { page: number; per_page: number; search?: string } = {
      page,
      per_page: 10,
    };
    const text = search?.trim();
    if (text) params.search = text;
    const response = await api.get("/locations", { params });
    return response.data;
  },

  getLocation: async (location: string | number): Promise<unknown> => {
    const response = await api.get(`/locations/${encodeURIComponent(String(location))}`);
    return response.data;
  },

  addLocation: async (payload: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post("/locations", payload);
    return response.data;
  },

  updateLocation: async (
    location: string | number,
    payload: Record<string, unknown>,
  ): Promise<unknown> => {
    const response = await api.put(`/locations/${encodeURIComponent(String(location))}`, payload);
    return response.data;
  },

  deleteLocation: async (location: string | number): Promise<unknown> => {
    const response = await api.delete(`/locations/${encodeURIComponent(String(location))}`);
    return response.data;
  },

  getLocationSelections: async (): Promise<unknown> => {
    const response = await api.get("/locations/selections");
    return response.data;
  },

  getSalesOrderSelections: async (): Promise<unknown> => {
    const response = await api.get("/SOs/selections");
    return response.data;
  },

// ADMIN PAYMENT API :
  getPayments: async (page = 1, search?: string): Promise<unknown> => {
    const params: { page: number; per_page: number; search?: string } = {
      page,
      per_page: 10,
    };
    const text = search?.trim();
    if (text) params.search = text;
    const response = await api.get("/payments", { params });
    return response.data;
  },

  getPayment: async (payment: string | number): Promise<unknown> => {
    const response = await api.get(`/payments/${encodeURIComponent(String(payment))}`);
    return response.data;
  },

  updatePayment: async (
    payment: string | number,
    payload: Record<string, unknown>,
  ): Promise<unknown> => {
    const response = await api.put(
      `/payments/${encodeURIComponent(String(payment))}`,
      payload,
    );
    return response.data;
  },

  voidPayment: async (
    payment: string | number,
    reason: string,
  ): Promise<unknown> => {
    const response = await api.patch(
      `/payments/${encodeURIComponent(String(payment))}/void`,
      { reason: reason.trim() },
    );
    return response.data;
  },

// UPLOAD API : Upload Installments
  uploadInstallments: async (rows: UploadRow[], fileName?: string): Promise<unknown> => {
    return postRows("/installments", rows, "Installments uploaded", fileName);
  },

  uploadPayments: async (rows: UploadRow[], fileName?: string): Promise<unknown> => {
    return postRows("/payments", rows, "Payments uploaded", fileName);
  },

 getLedger: (id: string | number) => api.get(`/ledger/${id}`).then((res) => res.data),
};

export default apiService;
