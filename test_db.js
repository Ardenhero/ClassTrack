const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: enrollments } = await supabase.from("enrollments").select("student_id, class_id").limit(1);
  const e = enrollments[0];

  const logsToInsert = [{
    student_id: e.student_id,
    class_id: e.class_id,
    user_id: null, // Test nullable
    status: "No Class",
    timestamp: "2026-02-25T00:00:00Z"
  }];

  const { data, error } = await supabase.from("attendance_logs").insert(logsToInsert).select();
  console.log("Insert with null user_id:", { data, error });

  if (!error) {
    await supabase.from("attendance_logs").delete().eq("id", data[0].id);
  }
}
run();
