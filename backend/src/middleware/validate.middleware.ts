import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

export const validate = (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => {
  const parsed = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!parsed.success) {
    return res.status(400).json({ message: "Validation error", issues: parsed.error.flatten() });
  }

  req.body = parsed.data.body;
  req.params = parsed.data.params;
  req.query = parsed.data.query;
  return next();
};
