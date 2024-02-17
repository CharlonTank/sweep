import { OperationRequest } from "../lib/types";
import { atom } from "recoil";

export const OperationRequestsState = atom({
  key: "fileChangeRequests",
  default: [] as OperationRequest[],
});
