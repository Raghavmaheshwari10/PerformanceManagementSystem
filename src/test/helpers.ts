import type {
  User,
  Cycle,
  CycleStatus,
  CycleType,
  UserRole,
  ActionResult,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// User factories
// ---------------------------------------------------------------------------

const NOW = "2026-01-01T00:00:00.000Z";

function baseUser(role: UserRole, overrides: Partial<User> = {}): User {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return {
    id: `test-${role}-1`,
    zimyo_id: `zimyo-test-${role}-1`,
    email: `${role}@test.com`,
    full_name: `Test ${label}`,
    role,
    department_id: "dept-1",
    is_also_employee: role !== "employee",
    is_founder: false,
    designation: label,
    manager_id: role === "employee" ? "test-manager-1" : null,
    variable_pay: 100_000,
    is_active: true,
    synced_at: NOW,
    created_at: NOW,
    ...overrides,
  };
}

/** Create a User with sensible defaults. Pass overrides for any field. */
export function makeUser(overrides: Partial<User> = {}): User {
  return baseUser(overrides.role ?? "employee", overrides);
}

/** Create an admin user. */
export function makeAdmin(overrides: Partial<User> = {}): User {
  return baseUser("admin", overrides);
}

/** Create a manager user. */
export function makeManager(overrides: Partial<User> = {}): User {
  return baseUser("manager", overrides);
}

/** Create an employee user. */
export function makeEmployee(overrides: Partial<User> = {}): User {
  return baseUser("employee", overrides);
}

/** Create an HRBP user. */
export function makeHrbp(overrides: Partial<User> = {}): User {
  return baseUser("hrbp", overrides);
}

// ---------------------------------------------------------------------------
// Cycle factory
// ---------------------------------------------------------------------------

/** Create a Cycle with sensible defaults. */
export function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: "cycle-1",
    name: "Q1 2026",
    quarter: "Q1",
    year: 2026,
    cycle_type: "quarterly" as CycleType,
    period: null,
    fiscal_year: null,
    status: "draft" as CycleStatus,
    kpi_setting_deadline: null,
    self_review_deadline: null,
    manager_review_deadline: null,
    calibration_deadline: null,
    published_at: null,
    sme_multiplier: null,
    total_budget: null,
    budget_currency: "INR",
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FormData helper
// ---------------------------------------------------------------------------

/**
 * Build a FormData instance from a plain object.
 *
 * Single string values are appended once; string arrays are appended
 * multiple times under the same key so that `formData.getAll(key)` works.
 */
export function makeFormData(
  entries: Record<string, string | string[]>,
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        fd.append(key, v);
      }
    } else {
      fd.append(key, value);
    }
  }
  return fd;
}

// ---------------------------------------------------------------------------
// ActionResult helpers
// ---------------------------------------------------------------------------

/** Build a successful ActionResult. */
export function ok<T = null>(data: T = null as T): ActionResult<T> {
  return { data, error: null };
}

/** Build a failed ActionResult. */
export function err<T = null>(error: string): ActionResult<T> {
  return { data: null, error };
}
