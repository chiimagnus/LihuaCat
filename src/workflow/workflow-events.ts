export type WorkflowProgressEvent = {
  stage:
    | "collect_images_start"
    | "collect_images_done"
    | "compress_images_start"
    | "compress_images_done"
    | "tabby_start"
    | "tabby_done"
    | "script_start"
    | "script_done"
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
