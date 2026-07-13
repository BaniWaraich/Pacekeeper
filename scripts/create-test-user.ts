/**
 * TEMPORARY — replaced by the seed script in step 5.
 *
 * Creates one user so login is verifiable before the seed exists:
 *   email:    test@pacekeeper.dev
 *   password: pacekeeper-test
 *
 * Run with:
 *   node --env-file=.env scripts/create-test-user.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "test@pacekeeper.dev";
  const passwordHash = bcrypt.hashSync("pacekeeper-test", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Test User" },
  });

  console.log(`Test user ready: ${user.email} (id: ${user.id})`);
  console.log("Password: pacekeeper-test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
