export type ActionResult<T = null> = { data: T; error: null } | { data: null; error: string }

export type UserRole = "employee" | "manager" | "hrbp" | "admin"
export type CycleStatus = "draft" | "kpi_setting" | "self_review" | "manager_review" | "calibrating" | "locked" | "published"
export type RatingTier = "FEE" | "EE" | "ME" | "SME" | "BE"
export type ReviewStatus = "draft" | "submitted"
export type NotificationType = "cycle_kpi_setting_open" | "cycle_self_review_open" | "cycle_manager_review_open" | "cycle_published" | "review_submitted" | "manager_review_submitted" | "admin_message" | "review_reminder"
export type NotificationStatus = "pending" | "sent" | "failed"

export interface User {
  id: string
  zimyo_id: string
  email: string
  full_name: string
  role: UserRole
  department: string | null
  designation: string | null
  manager_id: string | null
  variable_pay: number
  is_active: boolean
  synced_at: string
  created_at: string
  data_source?: "manual" | "zimyo" | "google"
}

export interface Cycle {
  id: string
  name: string
  quarter: string
  year: number
  status: CycleStatus
  kpi_setting_deadline: string | null
  self_review_deadline: string | null
  manager_review_deadline: string | null
  calibration_deadline: string | null
  published_at: string | null
  sme_multiplier: number | null
  business_multiplier: number
  total_budget: number | null
  budget_currency: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Kpi {
  id: string
  cycle_id: string
  employee_id: string
  manager_id: string
  title: string
  description: string | null
  weight: number | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  cycle_id: string
  employee_id: string
  self_rating: RatingTier | null
  self_comments: string
  status: ReviewStatus
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface Appraisal {
  id: string
  cycle_id: string
  employee_id: string
  manager_id: string
  manager_rating: RatingTier | null
  manager_comments: string | null
  manager_submitted_at: string | null
  final_rating: RatingTier | null
  final_rating_set_by: string | null
  payout_multiplier: number | null
  payout_amount: number | null
  snapshotted_variable_pay: number | null
  locked_at: string | null
  is_final: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  cycle_id: string | null
  changed_by: string
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  justification: string | null
  created_at: string
}

export interface KpiTemplate {
  id: string
  role_slug: string
  title: string
  description: string | null
  unit: "percent" | "number" | "boolean" | "rating"
  target: number | null
  weight: number | null
  category: "performance" | "behaviour" | "learning"
  sort_order: number
  is_active: boolean
  created_at: string
}
