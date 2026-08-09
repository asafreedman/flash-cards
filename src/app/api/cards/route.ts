import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readJsonObject } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

const MAX_FIELD_LENGTH = 5000;
const MAX_CATEGORY_LENGTH = 100;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cards = await prisma.card.findMany({
      where: { userId: user.id },
      include: {
        stat: true,
        reviews: {
          orderBy: { reviewedAt: "desc" },
          take: 25,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(cards);
  } catch {
    return NextResponse.json({ error: "Unable to load cards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const front = String(body.front ?? "").trim();
    const back = String(body.back ?? "").trim();
    const category = String(body.category ?? "Custom").trim() || "Custom";

    if (!front || front.length > MAX_FIELD_LENGTH) {
      return NextResponse.json(
        { error: `Front must be between 1 and ${MAX_FIELD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!back || back.length > MAX_FIELD_LENGTH) {
      return NextResponse.json(
        { error: `Back must be between 1 and ${MAX_FIELD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (category.length > MAX_CATEGORY_LENGTH) {
      return NextResponse.json(
        { error: `Category must be ${MAX_CATEGORY_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    const created = await prisma.card.create({
      data: { front, back, category, userId: user.id },
      include: { stat: true, reviews: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create card." }, { status: 500 });
  }
}
