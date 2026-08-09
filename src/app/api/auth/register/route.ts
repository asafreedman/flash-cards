import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hashPassword, setAuthCookie, signAuthToken } from "@/lib/auth";
import { readJsonObject } from "@/lib/api-validation";
import { getPrisma } from "@/lib/prisma";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 200;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const prisma = getPrisma();
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!email || email.length > MAX_EMAIL_LENGTH || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const token = signAuthToken({
      sub: String(user.id),
      name: user.name,
      email: user.email,
    });

    const response = NextResponse.json({ user }, { status: 201 });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
