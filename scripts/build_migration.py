import os, re

base = "C:/Users/tejas/OneDrive/Development Projects/PMS/supabase/migrations"
out  = "C:/Users/tejas/OneDrive/Development Projects/PMS/docs/audit/all_migrations_00001_to_00015.sql"

files = sorted(f for f in os.listdir(base) if f.endswith('.sql'))
raw = {}
for fname in files:
    with open(os.path.join(base, fname), encoding='utf-8') as f:
        raw[fname] = f.read().strip()

# ── Patch 00002: fix notifications table schema ───────────────────────────
old_notif = (
    "-- Notifications (email queue)\n"
    "CREATE TABLE notifications (\n"
    "  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n"
    "  recipient_id uuid REFERENCES users(id) NOT NULL,\n"
    "  type notification_type NOT NULL,\n"
    "  payload jsonb,\n"
    "  status notification_status DEFAULT 'pending',\n"
    "  sent_at timestamptz,\n"
    "  error_message text,\n"
    "  created_at timestamptz DEFAULT now()\n"
    ");"
)
new_notif = (
    "-- Notifications (in-app + email)\n"
    "CREATE TABLE notifications (\n"
    "  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n"
    "  user_id uuid REFERENCES users(id) NOT NULL,\n"
    "  type notification_type NOT NULL,\n"
    "  message text NOT NULL DEFAULT '',\n"
    "  link text,\n"
    "  is_read boolean NOT NULL DEFAULT false,\n"
    "  payload jsonb,\n"
    "  status notification_status DEFAULT 'pending',\n"
    "  sent_at timestamptz,\n"
    "  error_message text,\n"
    "  created_at timestamptz DEFAULT now()\n"
    ");"
)
raw['00002_create_tables.sql'] = raw['00002_create_tables.sql'].replace(old_notif, new_notif)

# ── Patch 00011: IF NOT EXISTS on data_source ─────────────────────────────
raw['00011_zimyo_independence.sql'] = raw['00011_zimyo_independence.sql'].replace(
    "ADD COLUMN data_source",
    "ADD COLUMN IF NOT EXISTS data_source"
)

# ── Patch 00012: IF NOT EXISTS on budget columns ──────────────────────────
raw['00012_budget_fields.sql'] = (
    raw['00012_budget_fields.sql']
    .replace("ADD COLUMN business_multiplier", "ADD COLUMN IF NOT EXISTS business_multiplier")
    .replace("ADD COLUMN budget_currency",     "ADD COLUMN IF NOT EXISTS budget_currency")
)


def transform(sql):
    lines = sql.split('\n')
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()

        # CREATE TYPE AS ENUM -> DO block
        if re.match(r'CREATE TYPE\s+\S+\s+AS\s+ENUM', s, re.I):
            stmt = [line]
            while not stmt[-1].rstrip().endswith(';') and i+1 < len(lines):
                i += 1; stmt.append(lines[i])
            body = '\n'.join(stmt).strip()
            out.append("DO $$ BEGIN\n  " + body + "\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;")
            i += 1; continue

        # CREATE TABLE -> IF NOT EXISTS
        if re.match(r'CREATE TABLE\s+(?!IF)', s, re.I):
            line = re.sub(r'CREATE TABLE\s+(?!IF)', 'CREATE TABLE IF NOT EXISTS ', line, flags=re.I)

        # CREATE UNIQUE INDEX -> IF NOT EXISTS
        if re.match(r'CREATE UNIQUE INDEX\s+(?!IF)', s, re.I):
            line = re.sub(r'CREATE UNIQUE INDEX\s+', 'CREATE UNIQUE INDEX IF NOT EXISTS ', line, flags=re.I)
        # CREATE INDEX -> IF NOT EXISTS
        elif re.match(r'CREATE INDEX\s+(?!IF)', s, re.I):
            line = re.sub(r'CREATE INDEX\s+', 'CREATE INDEX IF NOT EXISTS ', line, flags=re.I)

        # CREATE FUNCTION -> OR REPLACE
        if re.match(r'CREATE FUNCTION\s+', s, re.I):
            line = re.sub(r'CREATE FUNCTION\s+', 'CREATE OR REPLACE FUNCTION ', line, flags=re.I)

        # CREATE POLICY -> DROP first
        # Handle both single-line and two-line formats:
        #   CREATE POLICY foo ON bar ...
        #   CREATE POLICY foo\n  ON bar ...
        m = re.match(r'CREATE POLICY\s+(\w+)\s+ON\s+(\w+)', s, re.I)
        if not m and re.match(r'CREATE POLICY\s+(\w+)\s*$', s, re.I) and i+1 < len(lines):
            next_s = lines[i+1].strip()
            combined_line = s + ' ' + next_s
            m = re.match(r'CREATE POLICY\s+(\w+)\s+ON\s+(\w+)', combined_line, re.I)
        if m:
            out.append("DROP POLICY IF EXISTS " + m.group(1) + " ON " + m.group(2) + ";")

        # CREATE TRIGGER -> DROP first (handles BEFORE INSERT OR UPDATE etc.)
        m = re.match(r'CREATE TRIGGER\s+(\w+)\s+.*?\bON\s+(\w+)\b', s, re.I)
        if m:
            out.append("DROP TRIGGER IF EXISTS " + m.group(1) + " ON " + m.group(2) + ";")

        # ALTER TABLE ADD CONSTRAINT -> wrap in DO/EXCEPTION
        if re.match(r'ALTER TABLE', s, re.I) and 'ADD CONSTRAINT' in s.upper():
            stmt = [line]
            while not stmt[-1].rstrip().endswith(';') and i+1 < len(lines):
                i += 1; stmt.append(lines[i])
            body = '\n'.join(stmt).rstrip(';')
            out.append("DO $$ BEGIN\n  " + body + ";\nEXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;\nEND $$;")
            i += 1; continue

        # ALTER TABLE ADD COLUMN (without IF NOT EXISTS)
        if re.match(r'ALTER TABLE', s, re.I) and re.search(r'ADD COLUMN(?!\s+IF)', s, re.I):
            line = re.sub(r'ADD COLUMN(?!\s+IF\b)', 'ADD COLUMN IF NOT EXISTS', line, flags=re.I)

        out.append(line)
        i += 1
    return '\n'.join(out)


header = (
    "-- =====================================================\n"
    "-- COMPLETE MIGRATION: 00001 to 00015  (idempotent)\n"
    "-- Safe to run on any state of the database.\n"
    "-- Apply via Supabase SQL Editor:\n"
    "--   https://supabase.com/dashboard/project/cekmehtfghzhnzmxjbcx/sql\n"
    "-- =====================================================\n"
)

parts = [header]
for fname in files:
    parts.append(
        "\n-- =====================================================\n"
        "-- " + fname + "\n"
        "-- =====================================================\n"
        + transform(raw[fname]) + "\n"
    )

combined = '\n'.join(parts)

# Remove duplicate consecutive DROP POLICY lines (artifact of 00004 + 00013 both dropping same policy)
deduped = []
prev = None
for line in combined.split('\n'):
    if line == prev and re.match(r'DROP POLICY IF EXISTS', line.strip(), re.I):
        continue  # skip exact duplicate drop
    deduped.append(line)
    prev = line
combined = '\n'.join(deduped)

with open(out, 'w', encoding='utf-8') as f:
    f.write(combined)

checks = [
    ('notifications.user_id',                    'user_id uuid REFERENCES users(id) NOT NULL'),
    ('notifications.message',                    "message text NOT NULL DEFAULT ''"),
    ('notifications.is_read',                    'is_read boolean NOT NULL DEFAULT false'),
    ('ADD COLUMN IF NOT EXISTS data_source',      'ADD COLUMN IF NOT EXISTS data_source'),
    ('ADD COLUMN IF NOT EXISTS business_multiplier', 'ADD COLUMN IF NOT EXISTS business_multiplier'),
    ('ADD COLUMN IF NOT EXISTS budget_currency',  'ADD COLUMN IF NOT EXISTS budget_currency'),
    ('DROP TRIGGER kpi_weight_sum_check',         'DROP TRIGGER IF EXISTS kpi_weight_sum_check ON kpis'),
    ('DROP TRIGGER drafts_updated_at',            'DROP TRIGGER IF EXISTS drafts_updated_at ON drafts'),
    ('DO block: user_role enum',                  'CREATE TYPE user_role AS ENUM'),
    ('ADD CONSTRAINT wrapped in DO',              'EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL'),
    ('DROP POLICY users_employee_select',         'DROP POLICY IF EXISTS users_employee_select ON users'),
    ('DROP POLICY kpis_manager_insert',           'DROP POLICY IF EXISTS kpis_manager_insert ON kpis'),
    ('CREATE TABLE IF NOT EXISTS cycles',         'CREATE TABLE IF NOT EXISTS cycles'),
    ('DROP POLICY kpi_templates_select_all',      'DROP POLICY IF EXISTS kpi_templates_select_all ON kpi_templates'),
    ('DROP POLICY kpi_templates_admin_all',       'DROP POLICY IF EXISTS kpi_templates_admin_all ON kpi_templates'),
    ('no duplicate DROP lines',                   True),  # checked below
]
all_ok = True
for label, needle in checks:
    if needle is True:
        # special: check no duplicate consecutive DROP POLICY lines
        lines_list = combined.split('\n')
        dup_found = any(
            lines_list[j] == lines_list[j-1] and re.match(r'DROP POLICY IF EXISTS', lines_list[j].strip(), re.I)
            for j in range(1, len(lines_list))
        )
        found = not dup_found
    else:
        found = needle in combined
    if not found: all_ok = False
    print(("  OK  : " if found else "  FAIL: ") + label)

print()
print("Lines: " + str(combined.count('\n')) + "  Chars: " + str(len(combined)))
print("All checks passed!" if all_ok else "SOME CHECKS FAILED - see above")
