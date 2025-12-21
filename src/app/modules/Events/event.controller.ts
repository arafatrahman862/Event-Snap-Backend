import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../../shared/pick";
import { eventFilterableFields } from "../Admin/admin.constant";
import { eventService } from "./event.service";
import { jwtHelper } from "../../../helpers/jwtHelper";
import config from "../../../config";
import { clientEventFilterableFields } from "./event.constant";
import { JwtPayload } from "jsonwebtoken";

const getAllEvents = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, eventFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const accessToken = req.cookies["accessToken"];

  let user: JwtPayload | null = null;
  if (accessToken) {
    try {
      user = jwtHelper.verifyToken(
        accessToken,
        config.jwt.jwt_secret
      ) as JwtPayload;
    } catch {
      user = null;
    }
  }

  const result = await eventService.getAllEvents(filters, options, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All Events retrieved successfully",
    data: result,
  });
});

const getSingleEvent = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await eventService.getSingleEvent(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Single Event retrieved successfully",
    data: result,
  });
});

const getEventsParticipants = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await eventService.getEventsParticipants(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Events Participants List Retrieved successfully",
      data: result,
    });
  }
);

const joinEvent = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as JwtPayload;
  const result = await eventService.joinEvent(id, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your have joined  Event successfully",
    data: result,
  });
});

const leaveEvent = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as JwtPayload;
  const result = await eventService.leaveEvent(id, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "You have left the Event successfully",
    data: result,
  });
});

const getMyEvents = catchAsync(async (req: Request, res: Response) => {
  const accessToken = req.cookies["accessToken"];
  const filters = pick(req.query, clientEventFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const user = jwtHelper.verifyToken(
    accessToken,
    config.jwt.jwt_secret
  ) as JwtPayload;

  const result = await eventService.getMyEvents(user, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My Events retrieved successfully",
    data: result,
  });
});

const getRecentEvents = catchAsync(async (req: Request, res: Response) => {
  const result = await eventService.getRecentEvents();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recent 6 events retrieved successfully",
    data: result,
  });
});

export const eventController = {
  getAllEvents,
  getSingleEvent,
  joinEvent,
  leaveEvent,
  getMyEvents,
  getEventsParticipants,
  getRecentEvents,
};
