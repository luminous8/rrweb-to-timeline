import { MS_PER_SECOND, SECONDS_PER_MINUTE } from "../constants.js";

export const formatElapsedTime = (elapsedTimeMs: number) => {
  const totalElapsedSeconds = Math.max(0, Math.floor(elapsedTimeMs / MS_PER_SECOND));
  const elapsedSeconds = totalElapsedSeconds % SECONDS_PER_MINUTE;
  const totalElapsedMinutes = Math.floor(totalElapsedSeconds / SECONDS_PER_MINUTE);

  if (totalElapsedMinutes < SECONDS_PER_MINUTE) {
    return `${totalElapsedMinutes}:${elapsedSeconds.toString().padStart(2, "0")}`;
  }

  const elapsedMinutes = totalElapsedMinutes % SECONDS_PER_MINUTE;
  const elapsedHours = Math.floor(totalElapsedMinutes / SECONDS_PER_MINUTE);

  return `${elapsedHours}:${elapsedMinutes.toString().padStart(2, "0")}:${elapsedSeconds
    .toString()
    .padStart(2, "0")}`;
};
