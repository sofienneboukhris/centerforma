import { eventHandler } from "h3";
import { requireAuth } from "../../../utils/auth";
import { salleService } from "../../../services/salle.service";

export default eventHandler(async (event) => {
  await requireAuth(event);
  return salleService.list();
});
