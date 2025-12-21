import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { eventController } from "./event.controller";

const router = express.Router();

router.get("/all-events", eventController.getAllEvents);

router.get("/recent-events", eventController.getRecentEvents);

router.get("/my-events", auth(UserRole.CLIENT), eventController.getMyEvents);

router.get(
  "/:id",
  auth(UserRole.HOST, UserRole.ADMIN, UserRole.CLIENT),
  eventController.getSingleEvent
);

router.get(
  "/participants/:id",
  auth(UserRole.CLIENT, UserRole.HOST, UserRole.ADMIN),
  eventController.getEventsParticipants
);

router.post("/join/:id", auth(UserRole.CLIENT), eventController.joinEvent);

router.post("/leave/:id", auth(UserRole.CLIENT), eventController.leaveEvent);

export const EventRoutes = router;
