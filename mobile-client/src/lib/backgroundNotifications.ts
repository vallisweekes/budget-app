import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND-NOTIFICATION-TASK";

let didDefineTask = false;
let didRegisterTask = false;

if (!didDefineTask) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_NOTIFICATION_TASK,
    async ({ error }) => {
      if (__DEV__ && error) {
        console.warn("[push] background task error", error);
      }
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }
  );
  didDefineTask = true;
}

export async function registerBackgroundNotificationTaskAsync(): Promise<void> {
  if (didRegisterTask) return;

  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    didRegisterTask = true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[push] failed to register background notification task", error);
    }
  }
}
