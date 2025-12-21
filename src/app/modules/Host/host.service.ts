import { Event, EventCategory, EventStatus, Prisma } from "@prisma/client";
import config from "../../../config";
import prisma from "../../../shared/prisma";
import { Request } from "express";
import { Secret } from "jsonwebtoken";
import { jwtHelper } from "../../../helpers/jwtHelper";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../../helpers/paginationHelper";
import { eventSearchableFields } from "../Admin/admin.constant";
import { deleteImageFromCloudinary } from "../../../config/cloudinary.config";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";

const createEvent = async (req: Request): Promise<Event> => {
  const imageUrl = req.file?.path || "";
  const accessToken = req.cookies["accessToken"];

  const decodedData = jwtHelper.verifyToken(
    accessToken,
    config.jwt.jwt_secret as Secret
  ) as JwtPayload;

  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      id: decodedData.userId,
    },
    include: {
      host: true,
    },
  });

  if (!userData || !userData.host) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (userData.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  try {
    const result = await prisma.$transaction(async (transactionClient) => {
      const createdEventData = await transactionClient.event.create({
        data: {
          ...req.body,
          image: imageUrl,
          hostId: userData.host?.id,
        },
      });

      return createdEventData;
    });

    return result;
  } catch (error) {
    if (imageUrl) {
      await deleteImageFromCloudinary(imageUrl);
    }
    throw error;
  }
};

const deleteEvent = async (id: string): Promise<Event> => {
  const isEventExist = await prisma.event.findUnique({
    where: { id },
    include: { host: true },
  });

  if (!isEventExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found!");
  }

  const userInfo = await prisma.user.findUnique({
    where: { email: isEventExist?.host.email },
  });

  if (userInfo?.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  if (
    isEventExist.status !== EventStatus.CANCELLED &&
    isEventExist.status !== EventStatus.REJECTED &&
    isEventExist.status !== EventStatus.PENDING
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only PENDING, CANCELLED or REJECTED events can be deleted."
    );
  }

  const result = await prisma.event.delete({
    where: { id },
  });

  return result;
};
const updateEvent = async (id: string, req: Request): Promise<Event> => {
  const existingEvent = await prisma.event.findUnique({
    where: { id },
    include: { host: true },
  });

  if (!existingEvent) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found!");
  }

  const userInfo = await prisma.user.findUnique({
    where: { email: existingEvent.host.email },
  });

  if (userInfo?.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  if (
    existingEvent.status === EventStatus.CANCELLED ||
    existingEvent.status === EventStatus.REJECTED ||
    existingEvent.status === EventStatus.COMPLETED
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only Pending, Open or Full events can be updated."
    );
  }

  let newImageUrl = "";
  if (req.file) {
    newImageUrl = req.file.path;
    req.body.image = newImageUrl;
  }

  const updateData: Prisma.EventUpdateInput = { ...req.body };

  if (req.body.category !== undefined) {
    if (Array.isArray(req.body.category) && req.body.category.length > 0) {
      updateData.category = req.body.category;
    } else {
      updateData.category = existingEvent.category;
    }
  }

  try {
    if (newImageUrl) {
      await deleteImageFromCloudinary(existingEvent?.image);
    }

    return await prisma.event.update({
      where: { id },
      data: updateData,
    });
  } catch (error) {
    if (newImageUrl) {
      await deleteImageFromCloudinary(newImageUrl);
    }
    throw error;
  }
};

const cancelEvent = async (id: string): Promise<Event> => {
  const isEventExist = await prisma.event.findUniqueOrThrow({
    where: { id },
    include: { host: true },
  });

  const userInfo = await prisma.user.findUnique({
    where: { email: isEventExist?.host.email },
  });

  if (userInfo?.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  if (isEventExist.status !== EventStatus.PENDING) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only PENDING events can be canceled."
    );
  }

  const result = await prisma.event.update({
    where: { id },
    include: { host: true },
    data: { status: EventStatus.REJECTED },
  });

  return result;
};

interface GetMyEventsParams {
  searchTerm?: string;
  category?: string;
  date?: string;
  status?: string;
  [key: string]: any;
}

const getMyEvents = async (
  user:any,
  params: GetMyEventsParams,
  options: IPaginationOptions
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, category, date, status, ...filterData } = params;

  const accessToken = user.accessToken;

  const decodedData = jwtHelper.verifyToken(
    accessToken,
    config.jwt.jwt_secret as Secret
  ) as JwtPayload;

  const userInfo = await prisma.user.findUniqueOrThrow({
    where: {
      id: decodedData.userId,
    },
    include: {
      host: true,
    },
  });

  if (!userInfo.host) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Host information not found for the user."
    );
  }

  const andConditions: Prisma.EventWhereInput[] = [];

  andConditions.push({ hostId: userInfo.host.id });

  if (searchTerm) {
    andConditions.push({
      OR: eventSearchableFields.map((field) => ({
        [field]: { contains: String(searchTerm), mode: "insensitive" },
      })),
    });
  }

  if (status) {
    andConditions.push({ status: status as EventStatus });
  }

  if (category) {
    andConditions.push({
      category: {
        has: category as EventCategory,
      },
    });
  }

  if (date) {
    const parsed = new Date(String(date));
    if (!isNaN(parsed.getTime())) {
      const start = new Date(parsed);
      start.setHours(0, 0, 0, 0);
      const end = new Date(parsed);
      end.setHours(23, 59, 59, 999);
      andConditions.push({ date: { gte: start, lte: end } });
    }
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: { equals: (filterData as any)[key] },
      })),
    });
  }

  const whereConditions: Prisma.EventWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.event.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { createdAt: "desc" },
    include: { host: true },
  });

  const total = await prisma.event.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    eventRequests: result,
  };
};

const completeEvent = async (id: string): Promise<Event> => {
  const isEventExist = await prisma.event.findUnique({
    where: { id },
    include: { host: true },
  });

  if (!isEventExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  const userInfo = await prisma.user.findUnique({
    where: { email: isEventExist.host.email },
  });

  if (userInfo?.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  if (
    !(
      isEventExist.status === EventStatus.OPEN ||
      isEventExist.status === EventStatus.FULL
    )
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only events with status OPEN or FULL can be marked completed"
    );
  }

  const now = new Date();
  const eventDate = new Date(isEventExist.date);
  if (now.getTime() < eventDate.getTime()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Event date/time has not occurred yet"
    );
  }

  const updated = await prisma.event.update({
    where: { id },
    include: { host: true },
    data: { status: EventStatus.COMPLETED },
  });

  return updated;
};
export const hostService = {
  createEvent,
  deleteEvent,
  updateEvent,
  cancelEvent,
  getMyEvents,
  completeEvent,
};
