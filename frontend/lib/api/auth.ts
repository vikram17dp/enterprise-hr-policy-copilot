import { createClient } from "@/lib/supabase/client";

const API_URL = "http://localhost:8000/api/v1";

export async function signIn(
  email: string,
  password: string
) {
  const supabase = createClient();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}


export async function signUp(
  email: string,
  password: string,
  fullName: string
) {
  const supabase = createClient();

  const { data, error } =
    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}


export async function signOut() {
  const supabase = createClient();

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}


export async function syncUser() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No authenticated session found.");
  }

  const response = await fetch(
    `${API_URL}/auth/sync-user`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(
      () => null
    );

    throw new Error(
      errorData?.detail ||
        "Failed to synchronize user."
    );
  }

  return response.json();
}


export async function getMyProfile() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No authenticated session found.");
  }

  const response = await fetch(
    `${API_URL}/users/me`,
    {
      method: "GET",

      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(
      () => null
    );

    throw new Error(
      errorData?.detail ||
        "Failed to fetch user profile."
    );
  }

  return response.json();
}