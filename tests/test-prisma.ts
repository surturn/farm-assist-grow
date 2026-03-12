import * as dotenv from 'dotenv';
import * as path from 'path';
// Load environment variables before any other imports
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env.local') });

async function main() {
  const { prisma } = await import('@farmassist/database');
  try {
    const users = await prisma.user.findMany({ take: 1 });
    console.log("Prisma initialized properly. Users:", users);
  } catch (err) {
    const error = err as any;
    if (error.code === 'P1001' || error.message?.includes('connect')) {
       console.log("Prisma initialized properly, but no DB connection. This is expected if the container is not up.");
    } else {
       console.error("Prisma Error:", error);
    }
  }
}

main().catch(console.error);
