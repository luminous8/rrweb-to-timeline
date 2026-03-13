import type { Page } from "playwright";

export const saveVideo = async (page: Page, outputPath: string): Promise<string | null> => {
  const video = page.video();
  if (!video) return null;
  await page.close();
  await video.saveAs(outputPath);
  return outputPath;
};
