import { JwtPayload } from "jsonwebtoken";
import prisma from "../../../shared/prisma";
import {
  EventStatus,
  HostApplicationStatus,
  PaymentStatus,
  UserRole,
} from "@prisma/client";
import ApiError from "../../errors/ApiError";
import httpStatus from "http-status";

interface DashboardUserPayload extends JwtPayload {
  role: UserRole;
  email?: string;
}

const fetchDashboardMetaData = async (user: JwtPayload) => {
  const payload = user as DashboardUserPayload;

  if (!payload || !payload.role) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user payload");
  }

  if (payload.role === UserRole.ADMIN) {
    const [
      totalUsers,
      totalAdmins,
      totalClients,
      totalHosts,
      totalEvents,
      totalCompletedEvents,
      totalRejectedEvents,
      paymentsSumRes,
      adminIncomeRes,
      pendingHostApplications,
      pendingEventApplications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.count({ where: { role: UserRole.CLIENT } }),
      prisma.user.count({ where: { role: UserRole.HOST } }),
      prisma.event.count({
        where: {
          status: {
            in: [EventStatus.OPEN, EventStatus.FULL],
          },
        },
      }),
      prisma.event.count({ where: { status: EventStatus.COMPLETED } }),
      prisma.event.count({ where: { status: EventStatus.REJECTED } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          paymentStatus: {
            notIn: [
              PaymentStatus.CANCELLED,
              PaymentStatus.PENDING,
              PaymentStatus.REFUNDED,
            ],
          },
        },
      }),
      prisma.admin.aggregate({ _sum: { income: true } }),
      prisma.hostApplication.count({
        where: { status: HostApplicationStatus.PENDING },
      }),
      prisma.event.count({ where: { status: EventStatus.PENDING } }),
    ]);

    const totalPaymentsIncome = Number(paymentsSumRes._sum?.amount || 0);
    const totalAdminIncome = Number(adminIncomeRes._sum?.income || 0);

    return {
      role: UserRole.ADMIN,
      totalUsers,
      totalAdmins,
      totalHosts,
      totalClients,
      totalEvents,
      totalCompletedEvents,
      totalRejectedEvents,
      totalPaymentsIncome,
      totalAdminIncome,
      pendingHostApplications,
      pendingEventApplications,
    };
  }

  if (payload.role === UserRole.HOST) {
    if (!payload.email) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Host email missing in token");
    }

    const host = await prisma.host.findUnique({
      where: { email: payload.email },
    });

    if (!host) {
      throw new ApiError(httpStatus.NOT_FOUND, "Host profile not found");
    }

    const [
      totalEvents,
      totalCompletedEvents,
      totalRejectedEvents,
      totalPendingEvents,
      paymentsSumRes,
    ] = await Promise.all([
      prisma.event.count({
        where: {
          hostId: host.id,
          status: {
            in: [EventStatus.OPEN, EventStatus.FULL],
          },
        },
      }),
      prisma.event.count({
        where: { hostId: host.id, status: EventStatus.COMPLETED },
      }),
      prisma.event.count({
        where: { hostId: host.id, status: EventStatus.REJECTED },
      }),
      prisma.event.count({
        where: { hostId: host.id, status: EventStatus.PENDING },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          hostId: host.id,
          paymentStatus: PaymentStatus.PAID,
        },
      }),
    ]);

    const totalPaymentsIncome = Number(paymentsSumRes._sum?.amount || 0);

    return {
      role: UserRole.HOST,
      hostId: host.id,
      hostName: host.name,
      totalEvents,
      totalCompletedEvents,
      totalRejectedEvents,
      totalPendingEvents,
      totalPaymentsIncome,
      hostIncome: Number(host.income || 0),
      hostRating: Number(host.rating || 0),
      hostRatingCount: host.ratingCount || 0,
    };
  }

  throw new ApiError(
    httpStatus.BAD_REQUEST,
    "Dashboard not available for this user role"
  );
};

const getLandingPageStats = async () => {
  const [
    totalEvents,
    totalCompletedEvents,
    totalSuccessfulPayments,
    totalClients,
    totalHosts,
    totalReviews,
    avgHostRating,
  ] = await Promise.all([
    prisma.event.count({
      where: {
        status: {
          in: [EventStatus.OPEN, EventStatus.FULL],
        },
      },
    }),
    prisma.event.count({ where: { status: EventStatus.COMPLETED } }),
    prisma.payment.count({
      where: { paymentStatus: PaymentStatus.PAID },
    }),
    prisma.user.count({ where: { role: UserRole.CLIENT } }),
    prisma.user.count({ where: { role: UserRole.HOST } }),
    prisma.review.count(),
    prisma.host.aggregate({ _avg: { rating: true } }),
  ]);

  const averageHostRating = Number(avgHostRating._avg?.rating || 0).toFixed(2);

  return {
    stats: {
      totalEvents,
      totalCompletedEvents,
      totalSuccessfulPayments,
      totalClients,
      totalHosts,
      totalReviews,
      averageHostRating: Number(averageHostRating),
    },
    message: "Landing page statistics retrieved successfully",
  };
};

export const MetaService = {
  fetchDashboardMetaData,
  getLandingPageStats,
};
