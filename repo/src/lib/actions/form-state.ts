export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialActionState: ActionState = {
  status: "idle",
};
