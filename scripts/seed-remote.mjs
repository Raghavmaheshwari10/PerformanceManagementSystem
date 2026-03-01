import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cekmehtfghzhnzmxjbcx.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNla21laHRmZ2h6aG56bXhqYmN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI3MjQ1NSwiZXhwIjoyMDg3ODQ4NDU1fQ.fC2VlTQRCIMNXFUywhsTQv6GWWC60H7OHEHx8fEr9Jk";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  { email: "admin@test.com", password: "admin123", full_name: "Admin User", role: "admin", zimyo_id: "Z001", department: "HR", designation: "System Admin" },
  { email: "manager@test.com", password: "manager123", full_name: "Alice Manager", role: "manager", zimyo_id: "Z002", department: "Engineering", designation: "Engineering Manager" },
  { email: "frank@test.com", password: "frank123", full_name: "Frank Manager", role: "manager", zimyo_id: "Z003", department: "Sales", designation: "Sales Manager" },
  { email: "employee@test.com", password: "employee123", full_name: "Bob Employee", role: "employee", zimyo_id: "Z004", department: "Engineering", designation: "Software Engineer", manager_email: "manager@test.com" },
  { email: "dave@test.com", password: "dave123", full_name: "Dave Employee", role: "employee", zimyo_id: "Z005", department: "Engineering", designation: "Software Engineer", manager_email: "manager@test.com" },
  { email: "eve@test.com", password: "eve123", full_name: "Eve Employee", role: "employee", zimyo_id: "Z006", department: "Engineering", designation: "QA Engineer", manager_email: "manager@test.com" },
  { email: "grace@test.com", password: "grace123", full_name: "Grace Employee", role: "employee", zimyo_id: "Z007", department: "Sales", designation: "Sales Rep", manager_email: "frank@test.com" },
  { email: "henry@test.com", password: "henry123", full_name: "Henry Employee", role: "employee", zimyo_id: "Z008", department: "Sales", designation: "Sales Rep", manager_email: "frank@test.com" },
  { email: "irene@test.com", password: "irene123", full_name: "Irene Employee", role: "employee", zimyo_id: "Z009", department: "Sales", designation: "Account Manager", manager_email: "frank@test.com" },
  { email: "hrbp@test.com", password: "hrbp123", full_name: "HRBP User", role: "hrbp", zimyo_id: "Z010", department: "HR", designation: "HR Business Partner" },
];

async function main() {
  const emailToId = {};

  // Step 1: Create auth users
  console.log("=== Creating Auth Users ===");
  for (const u of TEST_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) {
      if (error.message.includes("already been registered")) {
        // Fetch existing user
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list.users.find((x) => x.email === u.email);
        if (existing) {
          emailToId[u.email] = existing.id;
          console.log(`  [exists] ${u.email} → ${existing.id}`);
          continue;
        }
      }
      console.error(`  [FAIL] ${u.email}: ${error.message}`);
      continue;
    }
    emailToId[u.email] = data.user.id;
    console.log(`  [created] ${u.email} → ${data.user.id}`);
  }

  // Step 2: Insert into public.users table
  console.log("\n=== Inserting Users Table Rows ===");
  for (const u of TEST_USERS) {
    const authId = emailToId[u.email];
    if (!authId) {
      console.error(`  [SKIP] ${u.email}: no auth ID`);
      continue;
    }

    const row = {
      id: authId,
      zimyo_id: u.zimyo_id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      department: u.department,
      designation: u.designation,
      manager_id: u.manager_email ? emailToId[u.manager_email] : null,
      variable_pay: 100000,
      is_active: true,
    };

    const { error } = await supabase.from("users").upsert(row, { onConflict: "id" });
    if (error) {
      console.error(`  [FAIL] ${u.email}: ${error.message}`);
    } else {
      console.log(`  [ok] ${u.full_name} (${u.role})`);
    }
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
