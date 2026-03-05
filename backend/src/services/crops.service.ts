import { prisma } from "@/db/prisma";

export const cropsService = {
  listByFarm: (farmId: string) => prisma.crop.findMany({ where: { farmId }, orderBy: { createdAt: "desc" } }),

  create: (farmId: string, data: { name: string; status: "PLANNED" | "GROWING" | "HARVESTED" }) =>
    prisma.crop.create({
      data: {
        farmId,
        ...data,
      },
    }),
};
