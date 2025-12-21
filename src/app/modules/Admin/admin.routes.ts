import express, { NextFunction, Request, Response } from 'express';
import { AdminController } from './admin.controller';
import validateRequest from '../../middlewares/validateRequest';
import { adminValidationSchemas } from './admin.validations';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get(
    '/host-applications',
    auth(UserRole.ADMIN),
    AdminController.getAllHostApplications
);


router.get(
    '/event-applications',
    auth(UserRole.ADMIN),
    AdminController.getAllEventApplications
);

router.get(
    '/clients',
    auth(UserRole.ADMIN),
    AdminController.getAllClients
); 

router.get(
    '/hosts',
    auth(UserRole.ADMIN),
    AdminController.getAllHosts
);

router.patch(
    '/suspend-user/:id',
    auth(UserRole.ADMIN),
    AdminController.suspendUser
)

router.patch(
    '/unsuspend-user/:id',
    auth(UserRole.ADMIN),
    AdminController.unsuspendUser
)

router.patch(
    '/host-applications/:id/approve',
    auth(UserRole.ADMIN),
    AdminController.approveHost
);

router.patch(
    '/host-applications/:id/reject',
    auth(UserRole.ADMIN),
    AdminController.rejectHost
);

router.patch(
    '/event-application/:id/approve',
    auth(UserRole.ADMIN),
    AdminController.approveEventIntoDB
);

router.patch(
    '/event-application/:id/reject',
    auth(UserRole.ADMIN),
    AdminController.rejectEvent
);

export const AdminRoutes = router;