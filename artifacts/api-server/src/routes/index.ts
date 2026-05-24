import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import usersRouter from "./users";
import departmentsRouter from "./departments";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import documentsRouter from "./documents";
import announcementsRouter from "./announcements";
import hrRouter from "./hr";
import analyticsRouter from "./analytics";
import meetingsRouter from "./meetings";
import notificationsRouter from "./notifications";
import chatRouter from "./chat";
import reimbursementsRouter from "./reimbursements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(usersRouter);
router.use(departmentsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(documentsRouter);
router.use(announcementsRouter);
router.use(hrRouter);
router.use(analyticsRouter);
router.use(meetingsRouter);
router.use(notificationsRouter);
router.use(chatRouter);
router.use(reimbursementsRouter);

export default router;
