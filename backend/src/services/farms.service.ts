import { prisma } from "@/db/prisma";

export const farmsService = {
  listForUser: (userId: string) =>
    prisma.farm.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: "desc" },
    }),

  create: (userId: string, data: { name: string; location?: string }) =>
    prisma.farm.create({
      data: {
        ...data,
        ownerId: userId,
      },
    }),
};
