import { Router } from "express";
import { farmsController } from "@/controllers/farms.controller";
import { validate } from "@/middleware/validate.middleware";
import { createFarmSchema } from "@/validators/farm.validator";
import { createCropSchema } from "@/validators/crop.validator";

const router = Router();

router.get("/", farmsController.list);
router.post("/", validate(createFarmSchema), farmsController.create);
router.get("/:farmId/crops", farmsController.listCrops);
router.post("/:farmId/crops", validate(createCropSchema), farmsController.createCrop);

export default router;
