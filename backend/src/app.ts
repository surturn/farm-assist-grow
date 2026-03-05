import express from "express";
import cors from "cors";
import helmet from "helmet";
import apiRoutes from "@/routes";
import { apiRateLimit } from "@/middleware/rate-limit.middleware";
import { errorHandler } from "@/middleware/error.middleware";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use("/api", apiRateLimit, apiRoutes);
  app.use(errorHandler);

  return app;
}
