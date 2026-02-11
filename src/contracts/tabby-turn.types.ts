export type TabbyOption = {
  id: string;
  label: string;
};

export type TabbyTurnOutput = {
  say: string;
  options: TabbyOption[];
  done: boolean;
  internalNotes?: string;
};

export type TabbyTurnValidationResult = {
  valid: boolean;
  errors: string[];
};

