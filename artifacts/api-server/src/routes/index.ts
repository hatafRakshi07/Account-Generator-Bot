import { Router, type IRouter } from "express";
import healthRouter from "./health";
import idsRouter from "./ids";
import batchesRouter from "./batches";
import settingsRouter from "./settings";
import proxiesRouter from "./proxies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(idsRouter);
router.use(batchesRouter);
router.use(settingsRouter);
router.use(proxiesRouter);

export default router;
