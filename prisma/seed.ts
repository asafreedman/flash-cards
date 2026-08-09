import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const defaultDeck = [
  {
    front: "hablar",
    back: "to speak",
    category: "Spanish",
  },
  {
    front: "estudiar",
    back: "to study",
    category: "Spanish",
  },
  {
    front: "trabajar",
    back: "to work",
    category: "Spanish",
  },
  {
    front: "caminar",
    back: "to walk",
    category: "Spanish",
  },
  {
    front: "necesitar",
    back: "to need",
    category: "Spanish",
  },
  {
    front: "comer",
    back: "to eat",
    category: "Spanish",
  },
  {
    front: "beber",
    back: "to drink",
    category: "Spanish",
  },
  {
    front: "aprender",
    back: "to learn",
    category: "Spanish",
  },
  {
    front: "leer",
    back: "to read",
    category: "Spanish",
  },
  {
    front: "vender",
    back: "to sell",
    category: "Spanish",
  },
  {
    front: "vivir",
    back: "to live",
    category: "Spanish",
  },
  {
    front: "escribir",
    back: "to write",
    category: "Spanish",
  },
  {
    front: "abrir",
    back: "to open",
    category: "Spanish",
  },
  {
    front: "recibir",
    back: "to receive",
    category: "Spanish",
  },
  {
    front: "decidir",
    back: "to decide",
    category: "Spanish",
  },
];

async function main() {
  const existingCount = await prisma.card.count();
  if (existingCount > 0) {
    return;
  }

  const defaultEmail = "demo@example.com";
  const defaultPasswordHash = await hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: defaultEmail },
    update: {},
    create: {
      email: defaultEmail,
      name: "Demo User",
      passwordHash: defaultPasswordHash,
    },
  });

  await prisma.card.createMany({
    data: defaultDeck.map((card) => ({
      ...card,
      userId: user.id,
    })),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
