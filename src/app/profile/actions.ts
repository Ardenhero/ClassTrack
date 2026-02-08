"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProfile(formData: FormData) {
    const supabase = createClient();
    const fullName = formData.get("fullName") as string;

    if (!fullName) {
        return { error: "Full name is required" };
    }

    const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
    });

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
}

export async function signOutAction() {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
}
