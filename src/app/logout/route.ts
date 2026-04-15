import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const url = new URL("/login", req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: ADMIN_AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
