import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_AUTH_COOKIE, isAdminAuthenticatedValue } from "@/lib/admin-auth";

export default async function Home() {
  const cookieStore = await cookies();
  const isLoggedIn = isAdminAuthenticatedValue(cookieStore.get(ADMIN_AUTH_COOKIE)?.value);
  redirect(isLoggedIn ? "/admin" : "/login");
}
