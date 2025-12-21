import prisma from "../../../shared/prisma";
import {
  PaymentStatus,
  ParticipantStatus,
  EventStatus,
  UserRole,
  Prisma,
} from "@prisma/client";
import { sendEmail } from "../../../helpers/sendEmail";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../../helpers/paginationHelper";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";

interface PaymentWithRelations {
  id: string;
  transactionId: string;
  amount: number;
  paymentStatus: PaymentStatus;
  participantId: string | null;
  hostId: string;
  createdAt: Date;
  invoiceUrl: string | null;
  event: {
    id: string;
    title: string;
    date: Date;
    location: string;
    joiningFee: number;
    host: { name: string; email: string };
  };
  client: {
    id: string;
    name: string;
    email: string;
    contactNumber: string | null;
  };
}

const successPayment = async (query: Record<string, string>) => {
  const transactionId =
    query.transactionId || query.tran_id || query.txnId || query.transaction_id;

  if (!transactionId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "transactionId is required in payment callback"
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { transactionId },
    select: {
      id: true,
      transactionId: true,
      amount: true,
      paymentStatus: true,
      participantId: true,
      hostId: true,
      createdAt: true,
      invoiceUrl: true,
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          joiningFee: true,
          host: { select: { name: true, email: true } },
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          contactNumber: true,
        },
      },
    },
  });

  if (!payment) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      `Payment not found for transactionId: ${transactionId}`
    );
  }

  if (payment.paymentStatus === PaymentStatus.PAID) {
    return {
      success: true,
      message: "Payment already processed",
      payment,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    const updatedParticipant = await tx.eventParticipant.update({
      where: { transactionId },
      data: { participantStatus: ParticipantStatus.CONFIRMED },
    });

    const host = await tx.host.findUnique({ where: { id: payment.hostId } });
    if (host) {
      const hostShare = Number((payment.amount * 0.9).toFixed(2));
      await tx.host.update({
        where: { id: host.id },
        data: { income: { increment: hostShare } },
      });
    }

    const admin = await tx.admin.findFirst();
    if (admin) {
      const adminShare = Number((payment.amount * 0.1).toFixed(2));
      await tx.admin.update({
        where: { id: admin.id },
        data: { income: { increment: adminShare } },
      });
    }

    return {
      success: true,
      payment: updatedPayment,
      participant: updatedParticipant,
    };
  });

  try {
    const paymentData = payment as PaymentWithRelations;
    const { client, event } = paymentData;
    const host = event?.host;

    if (client && client.email) {
      const invoiceDate = payment.createdAt
        ? new Date(payment.createdAt).toLocaleString()
        : new Date().toLocaleString();

      const templateData = {
        invoiceNumber: payment.transactionId || transactionId,
        invoiceDate,
        transactionId: payment.transactionId || transactionId,
        amount: payment.amount || 0,
        invoiceUrl: payment.invoiceUrl || null,
        client: {
          name: client.name || "",
          email: client.email || "",
          contactNumber: client.contactNumber || "",
        },
        event: {
          title: event?.title || "",
          dateReadable: event?.date
            ? new Date(event.date).toLocaleString()
            : "",
          location: event?.location || "",
        },
        host: {
          name: host?.name || "",
          email: host?.email || "",
        },
      };

      try {
        await sendEmail({
          to: client.email,
          subject: `Your Invoice for ${templateData.event.title || "Event"}`,
          templateName: "invoice-payment",
          templateData,
        });
      } catch (err) {
        // Silently fail email sending - payment is already processed
      }
    }
  } catch (err) {
    // Silently fail email sending - payment is already processed
  }

  return result;
};

const handlePaymentCancellation = async (query: Record<string, string>) => {
  const transactionId =
    query.transactionId || query.txnId || query.transaction_id;

  if (!transactionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "transactionId is required");
  }

  const payment = await prisma.payment.findUnique({
    where: { transactionId },
  });

  if (!payment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (
    payment.paymentStatus === PaymentStatus.CANCELLED ||
    payment.paymentStatus === PaymentStatus.REFUNDED
  ) {
    return {
      success: true,
      message: "Payment already cancelled",
      payment,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { paymentStatus: PaymentStatus.CANCELLED },
    });

    if (payment.participantId) {
      const participant = await tx.eventParticipant.findUnique({
        where: { id: payment.participantId },
        select: {
          id: true,
          participantStatus: true,
          eventId: true,
        },
      });

      if (
        participant &&
        participant.participantStatus !== ParticipantStatus.LEFT
      ) {
        await tx.eventParticipant.update({
          where: { id: participant.id },
          data: { participantStatus: ParticipantStatus.LEFT },
        });

        const event = await tx.event.findUnique({
          where: { id: participant.eventId },
          select: { id: true, capacity: true, status: true },
        });

        if (event) {
          const eventUpdateData: Prisma.EventUpdateInput = {
            capacity: event.capacity + 1,
            ...(event.status === EventStatus.FULL && {
              status: EventStatus.OPEN,
            }),
          };

          await tx.event.update({
            where: { id: event.id },
            data: eventUpdateData,
          });
        }
      }
    }

    return { success: true, payment: updatedPayment };
  });

  return result;
};

const failPayment = async (query: Record<string, string>) => {
  return handlePaymentCancellation(query);
};

const cancelPayment = async (query: Record<string, string>) => {
  return handlePaymentCancellation(query);
};

interface GetUserPaymentsParams {
  searchTerm?: string;
  paymentStatus?: string;
  [key: string]: any;
}

const getUserPayments = async (
  params: GetUserPaymentsParams,
  options: IPaginationOptions,
  user: JwtPayload
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, paymentStatus, ...filterData } = params;

  const andConditions: Prisma.PaymentWhereInput[] = [];

  if (user.role === UserRole.HOST) {
    const host = await prisma.host.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!host) {
      throw new ApiError(httpStatus.NOT_FOUND, "Host profile not found");
    }

    andConditions.push({
      hostId: host.id,
    });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          transactionId: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          client: {
            name: { contains: searchTerm, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (paymentStatus) {
    andConditions.push({
      paymentStatus: paymentStatus as PaymentStatus,
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: { equals: (filterData as any)[key] },
      })),
    });
  }

  const whereConditions: Prisma.PaymentWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.payment.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, date: true } },
      client: { select: { id: true, name: true, email: true } },
    },
  });

  const total = await prisma.payment.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    data: result,
  };
};

export const paymentServices = {
  successPayment,
  failPayment,
  cancelPayment,
  getUserPayments,
};
