import express, { NextFunction, Request, Response } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { hostValidation } from "./host.validation";
import { hostController } from "./host.controller";
import { multerUpload } from "../../../config/multer.config";

const router = express.Router();

router.post(
  "/create-event",
  auth(UserRole.HOST),
  multerUpload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = hostValidation.createEvent.parse(JSON.parse(req.body.data));
    return hostController.createEvent(req, res, next);
  }
);

router.get(
  "/my-hosted-events",
  auth(UserRole.HOST),
  hostController.getMyEvents
);

router.patch(
  "/event/:id",
  auth(UserRole.HOST),
  multerUpload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = hostValidation.updateEvent.parse(JSON.parse(req.body.data));
    return hostController.updateEvent(req, res, next);
  }
);

router.patch(
  "/event-complete/:id",
  auth(UserRole.HOST),
  hostController.completeEvent
);

router.delete("/event/:id", auth(UserRole.HOST), hostController.deleteEvent);

router.patch(
  "/event/:id/cancel",
  auth(UserRole.HOST),
  hostController.cancelEvent
);

export const HostRoutes = router;
