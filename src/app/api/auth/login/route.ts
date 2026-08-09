import { NextResponse } from "next/server";
import { setAuthCookie, signAuthToken, verifyPassword } from "@/lib/auth";
import { readJsonObject } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || email.length > MAX_EMAIL_LENGTH || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = signAuthToken({
      sub: String(user.id),
      name: user.name,
      email: user.email,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
    setAuthCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
