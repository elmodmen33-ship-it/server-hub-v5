import { Router, type IRouter } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import settingsRouter from "./settings";
import healthRouter from "./health";
import systemRouter from "./system";
import filesRouter from "./files";
import aiRouter from "./ai";
import { terminalRouterAPI } from "./terminal";
import tunnelRouter from "./tunnel";
import logsRouter from "./logs";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(authRouter);
router.use(usersRouter);
router.use(settingsRouter);
router.use(healthRouter);
router.use(systemRouter);
router.use(filesRouter);
router.use(aiRouter);
router.use(terminalRouterAPI);
router.use(tunnelRouter);
router.use(logsRouter);
router.use(activityRouter);

export default router;
