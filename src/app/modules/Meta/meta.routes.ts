import express from "express";
import { MetaController } from "./meta.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.get(
  "/",
  auth(UserRole.ADMIN, UserRole.HOST),
  MetaController.fetchDashboardMetaData
);

router.get("/landing-page", MetaController.getLandingPageStats);

export const MetaRoutes = router;
