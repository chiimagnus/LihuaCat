export type WorkflowProgressEvent = {
  stage:
    | "collect_images_start"
    | "collect_images_done"
    | "generate_script_start"
    | "generate_script_done"
    | "tabby_start"
    | "tabby_done"
    | "ocelot_start"
    | "ocelot_done"
    | "choose_mode"
    | "render_start"
    | "render_failed"
    | "render_success"
    | "publish_start"
    | "publish_done";
  message: string;
};

export type WorkflowProgressReporter = (
  event: WorkflowProgressEvent,
) => Promise<void> | void;
