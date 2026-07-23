export {
  creditosService,
  mockCreditosService,
  httpCreditosService,
} from "./api/creditos-service";
export type { CreditosService } from "./api/creditos-service";
export {
  useCreditos,
  useCredito,
  useCreateCredito,
  useUpdateCredito,
  useAnularCredito,
} from "./api/use-creditos";
export { CreateCreditoScreen } from "./ui/CreateCreditoScreen";
export type { CreateCreditoScreenProps } from "./ui/CreateCreditoScreen";
export { CreditoDetailScreen } from "./ui/CreditoDetailScreen";
export { CreditoFields, ClientePicker } from "./ui/CreditoFields";
