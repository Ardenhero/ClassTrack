"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function login(formData: FormData) {
    const supabase = createClient();

    const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    if (!data.email || !data.password) {
        return { error: "Email and password are required" };
    }

    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
        return { error: error.message };
    }

    // Clear the profile cookie so user goes to profile selection
    const cookieStore = await cookies();
    cookieStore.delete("sc_profile_id");

    revalidatePath("/", "layout");
    redirect("/select-profile");
}

export async function signup(formData: FormData) {
    const supabase = createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string || email.split("@")[0];

    if (!email || !password) {
        return { error: "Email and password are required" };
    }

    // Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        if (authError.message.includes("rate limit") || authError.message.includes("429")) {
            return { error: "Too many attempts. Please wait a moment." };
        }
        return { error: authError.message };
    }

    if (!authData.user) {
        return { error: "Failed to create account." };
    }

    // Create the account request via RPC (bypasses RLS since new user has no session)
    const { error: requestError } = await supabase
        .rpc("create_account_request", {
            p_user_id: authData.user.id,
            p_email: email,
            p_name: name,
        });

    if (requestError) {
        console.error("Error creating account request:", requestError);
    }

    // Return success to display the pending message
    return { success: true, pending: true };
}

export async function signout() {
    const supabase = createClient();

    // Clear the profile cookie
    const cookieStore = await cookies();
    cookieStore.delete("sc_profile_id");

    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
}