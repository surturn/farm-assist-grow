import type { Request, Response } from "express";
import { farmsService } from "@/services/farms.service";
import { cropsService } from "@/services/crops.service";

export const farmsController = {
  list: async (req: Request, res: Response) => {
    const farms = await farmsService.listForUser(req.user!.uid);
    return res.json(farms);
  },

  create: async (req: Request, res: Response) => {
    const farm = await farmsService.create(req.user!.uid, req.body);
    return res.status(201).json(farm);
  },

  listCrops: async (req: Request, res: Response) => {
    const crops = await cropsService.listByFarm(req.params.farmId);
    return res.json(crops);
  },

  createCrop: async (req: Request, res: Response) => {
    const crop = await cropsService.create(req.params.farmId, req.body);
    return res.status(201).json(crop);
  },
};
