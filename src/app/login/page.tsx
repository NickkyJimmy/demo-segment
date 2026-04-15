import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_AUTH_COOKIE,
  buildAdminSessionCookie,
  isAdminAuthenticatedValue,
  isValidAdminCredentials,
  normalizeAdminNextPath,
} from "@/lib/admin-auth";

async function loginAction(formData: FormData) {
  "use server";

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "");
  const nextPath = normalizeAdminNextPath(nextRaw);

  if (!isValidAdminCredentials(username, password)) {
    redirect(`/login?error=${encodeURIComponent("Sai tài khoản hoặc mật khẩu")}&next=${encodeURIComponent(nextPath)}`);
  }

  const session = buildAdminSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(session.name, session.value, session.options);

  redirect(nextPath);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = normalizeAdminNextPath(params.next);
  const errorMessage = params.error;

  const cookieStore = await cookies();
  if (isAdminAuthenticatedValue(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="rounded-3xl border bg-card/95 p-6 shadow-sm md:p-8">
        <p className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase">
          Đăng nhập quản trị
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vui lòng nhập tài khoản quản trị để truy cập khu vực admin.</p>

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />

          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              name="username"
              required
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 transition focus:ring"
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-primary/30 transition focus:ring"
              placeholder="admin"
            />
          </div>

          {errorMessage ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p> : null}

          <button type="submit" className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Đăng nhập
          </button>
        </form>
      </section>
    </main>
  );
}
