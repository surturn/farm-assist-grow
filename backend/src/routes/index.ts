import { Router } from "express";
import farmsRoutes from "@/routes/farms.routes";
import { requireAuth } from "@/middleware/auth.middleware";
import { analyzeCropImage } from "@/services/ai.service";
import { getOrSetCache } from "@/cache/redis";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));
router.use("/farms", requireAuth, farmsRoutes);

router.post("/analyze-crop", requireAuth, async (req, res, next) => {
  try {
    const { imageBase64 } = req.body;
    const cacheKey = `ai:crop:${Buffer.from(imageBase64).subarray(0, 24).toString("base64")}`;
    const result = await getOrSetCache(cacheKey, 60 * 15, () => analyzeCropImage(imageBase64));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
