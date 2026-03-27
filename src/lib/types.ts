export type ActionResult<T = null> = { data: T; error: null } | { data: null; error: string }

export type UserRole = "employee" | "manager" | "hrbp" | "admin"
export type CycleStatus = "draft" | "kpi_setting" | "self_review" | "manager_review" | "calibrating" | "locked" | "published"
export type RatingTier = "FEE" | "EE" | "ME" | "SME" | "BE"
export type ReviewStatus = "draft" | "submitted"
export type NotificationType = "cycle_kpi_setting_open" | "cycle_self_review_open" | "cycle_manager_review_open" | "cycle_published" | "review_submitted" | "manager_review_submitted" | "admin_message" | "review_reminder"
export type NotificationStatus = "pending" | "sent" | "failed"

export interface Department {
  id: string
  name: string
  created_at: string
}

export interface HrbpDepartment {
  hrbp_id: string
  department_id: string
  department?: Department
}

export interface PayoutConfig {
  rating_tier: RatingTier
  multiplier: number
  updated_by: string | null
  updated_at: string
}

export interface User {
  id: string
  zimyo_id: string
  email: string
  full_name: string
  role: UserRole
  department_id?: string | null
  department?: Department        // joined, optional
  is_also_employee: boolean
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
  fee_multiplier?: number | null
  ee_multiplier?:  number | null
  me_multiplier?:  number | null
}

export interface Kpi {
  id: string
  cycle_id: string
  employee_id: string
  manager_id: string
  kra_id: string | null
  title: string
  description: string | null
  weight: number | null
  created_at: string
  updated_at: string
  kra?: Kra
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
  mis_score: number | null
  suggested_rating: RatingTier | null
  override_reason: string | null
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

export interface KraTemplate {
  id: string
  title: string
  description: string | null
  category: string
  role_slug: string | null
  department_id: string | null
  weight: number | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Kra {
  id: string
  cycle_id: string
  employee_id: string
  title: string
  description: string | null
  category: string
  weight: number | null
  sort_order: number
  created_at: string
  kpis?: Kpi[]
}

export type GoalType = "business" | "development" | "behavior"
export type GoalStatus = "draft" | "submitted" | "approved" | "rejected" | "completed" | "closed"

export interface Goal {
  id: string
  cycle_id: string
  employee_id: string
  title: string
  description: string | null
  goal_type: GoalType
  target_value: number | null
  current_value: number | null
  unit: string | null
  weight: number | null
  start_date: string | null
  due_date: string | null
  status: GoalStatus
  manager_comment: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface GoalUpdate {
  id: string
  goal_id: string
  updated_by: string
  previous_value: number | null
  new_value: number | null
  note: string | null
  created_at: string
}

export type FeedbackCategory = "teamwork" | "leadership" | "ownership" | "communication" | "innovation"
export type FeedbackVisibility = "private" | "recipient_and_manager" | "public_team"

export interface Feedback {
  id: string
  from_user_id: string
  to_user_id: string
  category: FeedbackCategory
  message: string
  visibility: FeedbackVisibility
  linked_goal_id: string | null
  created_at: string
  from_user?: { full_name: string }
}

export type PeerReviewStatus = "requested" | "accepted" | "declined" | "submitted"

export interface PeerReviewRequest {
  id: string
  cycle_id: string
  reviewee_id: string
  peer_user_id: string
  requested_by: string
  status: PeerReviewStatus
  peer_rating: RatingTier | null
  peer_comments: string | null
  created_at: string
  reviewee?: { full_name: string }
  peer_user?: { full_name: string }
}

export type AnswerType = "rating" | "text" | "mixed"

export interface Competency {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface ReviewTemplate {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  questions?: ReviewQuestion[]
}

export interface ReviewQuestion {
  id: string
  template_id: string
  competency_id: string | null
  question_text: string
  answer_type: AnswerType
  is_required: boolean
  order_index: number
}

// ─────────────────────────────────────────
// MIS Integration Types
// ─────────────────────────────────────────

export interface AopTarget {
  id: string
  external_id: string
  fiscal_year: number
  level: string
  department_id: string | null
  employee_id: string | null
  metric_name: string
  category: string
  annual_target: number
  unit: string
  currency: string | null
  monthly_targets: Record<string, number> | null
  ytd_actual: number | null
  red_threshold: number
  amber_threshold: number
  synced_at: string
  created_at: string
}

export interface MisActual {
  id: string
  aop_target_id: string
  year: number
  month: number
  actual_value: number
  ytd_actual: number | null
  notes: string | null
  synced_at: string
}

export interface KpiMisMapping {
  id: string
  kpi_id: string
  aop_target_id: string
  weight_factor: number
  score_formula: string
}

export interface MisSyncLog {
  id: string
  sync_type: string
  status: string
  records_synced: number
  records_failed: number
  error_message: string | null
  triggered_by: string | null
  started_at: string
  completed_at: string | null
}

export interface MisConfig {
  id: string
  api_base_url: string
  api_key_encrypted: string
  fiscal_year: number
  auto_sync_enabled: boolean
  sync_cron: string
  department_mapping: Record<string, string>
  updated_at: string
}

export interface ScoringConfig {
  id: string
  rating_tier: string
  min_score: number
  is_active: boolean
}
