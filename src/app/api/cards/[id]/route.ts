import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parsePositiveInt, readJsonObject } from "@/lib/api-validation";
import { getPrisma } from "@/lib/prisma";

const MAX_FIELD_LENGTH = 5000;
const MAX_CATEGORY_LENGTH = 100;

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const cardId = parsePositiveInt(id);
    if (cardId === null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
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

    const { count } = await prisma.card.updateMany({
      where: { id: cardId, userId: user.id },
      data: { front, back, category },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    const updated = await prisma.card.findFirst({
      where: { id: cardId, userId: user.id },
      include: { stat: true },
    });

    if (!updated) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unable to update card." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const cardId = parsePositiveInt(id);
    if (cardId === null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }

    const { count } = await prisma.card.deleteMany({
      where: { id: cardId, userId: user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete card." }, { status: 500 });
  }
}
