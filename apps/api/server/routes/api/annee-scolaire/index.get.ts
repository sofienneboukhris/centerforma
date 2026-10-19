import { eventHandler } from "h3";
import { requireAuth } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";

export default eventHandler(async (event) => {
  await requireAuth(event);
  return classeService.listAnnees();
});
