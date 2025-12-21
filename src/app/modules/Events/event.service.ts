import {
  EventCategory,
  EventStatus,
  ParticipantStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import prisma from "../../../shared/prisma";
import { v4 as uuidv4 } from "uuid";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../../helpers/paginationHelper";
import { eventSearchableFields } from "../Admin/admin.constant";
import { ISSLCommerz } from "../sslCommerz/sslCommerz.interface";
import { SSLService } from "../sslCommerz/sslCommerz.service";
import { clientEventSearchableFields } from "./event.constant";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";

const getTransactionId = (): string => {
  return `tran_${uuidv4()}`;
};

interface GetAllEventsParams {
  searchTerm?: string;
  category?: string;
  date?: string;
  status?: string;
  [key: string]: any;
}

const getAllEvents = async (
  params: GetAllEventsParams,
  options: IPaginationOptions,
  user: JwtPayload | null
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, category, date, status, ...filterData } = params;

  const andConditions: Prisma.EventWhereInput[] = [];

  andConditions.push({ status: EventStatus.OPEN });

  const now = new Date();
  andConditions.push({ date: { gte: now } });

  if (searchTerm) {
    andConditions.push({
      OR: eventSearchableFields.map((field) => ({
        [field]: { contains: String(searchTerm), mode: "insensitive" },
      })),
    });
  }

  if (status) andConditions.push({ status: status as any });

  if (category) {
    andConditions.push({
      category: { has: category as EventCategory },
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

  const events = await prisma.event.findMany({
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

  if (user && user.role !== "ADMIN") {
    const client = await prisma.client.findUnique({
      where: { email: user.email },
      select: { interests: true },
    });

    const host = await prisma.host.findUnique({
      where: { email: user.email },
      select: { interests: true },
    });

    const userInterests = client?.interests || host?.interests || [];

    if (userInterests.length > 0) {
      const mindLikeEvents: typeof events = [];
      const otherEvents: typeof events = [];

      for (const ev of events) {
        const match = ev.category.some((c) =>
          userInterests.includes(c as EventCategory)
        );

        if (match) {
          mindLikeEvents.push(ev);
        } else {
          otherEvents.push(ev);
        }
      }

      const orderedEvents = [...mindLikeEvents, ...otherEvents];

      return {
        meta: { page, limit, total },
        eventRequests: orderedEvents,
      };
    }
  }
  return {
    meta: { page, limit, total },
    eventRequests: events,
  };
};

interface GetMyEventsParams {
  searchTerm?: string;
  category?: string;
  date?: string;
  status?: string;
  participantStatus?: string;
  [key: string]: any;
}

const getMyEvents = async (
  user: JwtPayload,
  params: GetMyEventsParams,
  options: IPaginationOptions
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const {
    searchTerm,
    category,
    date,
    status,
    participantStatus,
    ...filterData
  } = params;

  const clientRecord = await prisma.user.findUniqueOrThrow({
    where: { email: user.email },
    include: { client: true },
  });

  if (!clientRecord.client) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You are not registered as a client"
    );
  }

  const clientId = clientRecord.client.id;

  const eventFilters: Prisma.EventWhereInput[] = [];

  if (searchTerm) {
    eventFilters.push({
      OR: clientEventSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  if (status) {
    eventFilters.push({ status: status as EventStatus });
  }

  if (category) {
    eventFilters.push({
      category: { has: category as EventCategory },
    });
  }

  if (date) {
    const parsed = new Date(String(date));
    if (!isNaN(parsed.getTime())) {
      const start = new Date(parsed);
      start.setHours(0, 0, 0, 0);

      const end = new Date(parsed);
      end.setHours(23, 59, 59, 999);

      eventFilters.push({ date: { gte: start, lte: end } });
    }
  }

  if (Object.keys(filterData).length > 0) {
    eventFilters.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: { equals: (filterData as any)[key] },
      })),
    });
  }

  const whereConditions: Prisma.EventParticipantWhereInput = {
    clientId,
    ...(participantStatus && {
      participantStatus: participantStatus as ParticipantStatus,
    }),
    ...(eventFilters.length > 0 && { event: { AND: eventFilters } }),
  };

  const result = await prisma.eventParticipant.findMany({
    where: whereConditions,
    include: {
      event: true,
      client: true,
    },
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { createdAt: "desc" },
  });

  const total = await prisma.eventParticipant.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

const getSingleEvent = async (id: string) => {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      host: true,
      participants: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!event) return null;

  const participantsCount = event.participants.length;

  const participantsInfo = event.participants.map((p) => ({
    id: p.id,
    joinedAt: p.createdAt,
    clientId: p.clientId,
    client: {
      id: p.client.id,
      name: p.client.name,
      email: p.client.email,
      profilePhoto: p.client.profilePhoto,
      contactNumber: p.client.contactNumber,
      location: p.client.location,
      bio: p.client.bio,
      interests: p.client.interests,
    },
  }));

  return {
    ...event,
    participantsCount,
    participantsInfo,
  };
};

const getEventsParticipants = async (eventId: string) => {
  const result = await prisma.eventParticipant.findMany({
    where: {
      eventId,
      participantStatus: { not: ParticipantStatus.LEFT },
    },
    include: {
      client: true,
      review: true,
    },
  });

  const participantsWithReviewStatus = result.map((participant) => ({
    ...participant,
    hasReviewed: !!participant.review,
    review: undefined,
  }));

  return {
    data: participantsWithReviewStatus,
  };
};

export const joinEvent = async (eventId: string, user: JwtPayload) => {
  const client = await prisma.client.findUnique({
    where: { email: user.email },
    include: { user: true },
  });

  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, "Client not found");
  }

  if (client.user.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  if (client.isDeleted) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Client account is deleted");
  }

  if (client.user.status !== "ACTIVE") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Client account is not active");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { host: true },
  });

  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (event.status !== EventStatus.OPEN) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Event is not open");
  }

  if (event.date < new Date()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Event date has passed");
  }

  const existing = await prisma.eventParticipant.findFirst({
    where: {
      eventId,
      clientId: client.id,
      participantStatus: { not: ParticipantStatus.LEFT },
    },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "You have already joined this event"
    );
  }

  const transactionId = getTransactionId();

  const result = await prisma.$transaction(async (tx) => {
    const eventForUpdate = await tx.event.findUnique({
      where: { id: eventId },
    });

    if (!eventForUpdate) {
      throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
    }

    if (eventForUpdate.capacity < 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No seats available");
    }

    const newParticipant = await tx.eventParticipant.create({
      data: {
        eventId,
        clientId: client.id,
        participantStatus: ParticipantStatus.PENDING,
        transactionId,
      },
    });

    const payment = await tx.payment.create({
      data: {
        transactionId,
        amount: eventForUpdate.joiningFee,
        participantId: newParticipant.id,
        eventId,
        clientId: client.id,
        hostId: eventForUpdate.hostId,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const newCapacity = eventForUpdate.capacity - 1;
    if (newCapacity < 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No seats available");
    }

    const eventUpdateData: Prisma.EventUpdateInput = {
      capacity: newCapacity,
      ...(newCapacity === 0 && { status: EventStatus.FULL }),
    };

    const updatedEvent = await tx.event.update({
      where: { id: eventId },
      data: eventUpdateData,
    });

    const sslPayload: ISSLCommerz = {
      address: client.location,
      email: client.email,
      phoneNumber: client.contactNumber,
      name: client.name,
      amount: eventForUpdate.joiningFee,
      transactionId: transactionId,
    };

    const sslPayment = await SSLService.sslPaymentInit(sslPayload);

    return {
      paymentUrl: sslPayment.GatewayPageURL,
      newParticipant,
      payment,
      updatedEvent,
    };
  });

  return result;
};

export const leaveEvent = async (eventId: string, user: JwtPayload) => {
  const client = await prisma.client.findUnique({
    where: { email: user.email },
    include: { user: true },
  });

  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, "Client not found");
  }

  if (client.user.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  if (client.isDeleted) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Client account is deleted");
  }

  if (client.user.status !== "ACTIVE") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Client account is not active");
  }

  const participation = await prisma.eventParticipant.findFirst({
    where: {
      eventId,
      clientId: client.id,
      participantStatus: { not: ParticipantStatus.LEFT },
    },
    include: {
      event: true,
      client: true,
    },
  });
  if (!participation) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "You have not joined this event or already left"
    );
  }

  if (participation.event.date < new Date()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Event date has passed, you cannot leave now"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedParticipation = await tx.eventParticipant.update({
      where: { id: participation.id },
      data: { participantStatus: ParticipantStatus.LEFT },
    });

    const eventCurrent = await tx.event.findUnique({
      where: { id: participation.eventId },
      select: { capacity: true, status: true },
    });

    if (!eventCurrent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
    }

    const eventUpdateData: Prisma.EventUpdateInput = {
      capacity: eventCurrent.capacity + 1,
      ...(eventCurrent.status === EventStatus.FULL && {
        status: EventStatus.OPEN,
      }),
    };

    const updatedEvent = await tx.event.update({
      where: { id: participation.eventId },
      data: eventUpdateData,
    });

    return { updatedParticipation, updatedEvent };
  });
  return result;
};

export const completeEvent = async (eventId: string, user: JwtPayload) => {
  const userInfo = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!userInfo) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (userInfo.status === "SUSPENDED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. You cannot perform this operation."
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { host: true },
  });

  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, "Event not found");
  }

  if (
    !(event.status === EventStatus.OPEN || event.status === EventStatus.FULL)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Event cannot be marked completed unless it is OPEN or FULL"
    );
  }

  const now = new Date();
  if (now.getTime() < new Date(event.date).getTime()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Event date/time has not occurred yet"
    );
  }

  if (user.role !== "ADMIN") {
    if (user.role === "HOST") {
      const host = await prisma.host.findUnique({
        where: { email: user.email },
      });

      if (!host || host.id !== event.hostId) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "You are not authorized to complete this event"
        );
      }
    } else {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You are not authorized to complete this event"
      );
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { status: EventStatus.COMPLETED },
  });

  return updated;
};

const getRecentEvents = async () => {
  const now = new Date();

  const result = await prisma.event.findMany({
    where: {
      status: EventStatus.OPEN,
      date: { gte: now },
    },
    take: 6,
    orderBy: { createdAt: "desc" },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
          rating: true,
        },
      },
    },
  });

  return result;
};

export const eventService = {
  getAllEvents,
  getSingleEvent,
  joinEvent,
  leaveEvent,
  getMyEvents,
  completeEvent,
  getEventsParticipants,
  getRecentEvents,
};
