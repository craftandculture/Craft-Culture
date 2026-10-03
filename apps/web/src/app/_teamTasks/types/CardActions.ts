/** The actions every view hands its job cards */
export interface CardActions {
  today: string;
  onOpen: (taskId: string) => void;
  onTick: (partId: string, done: boolean) => void;
  onClose: (taskId: string) => void;
  busy: boolean;
}
