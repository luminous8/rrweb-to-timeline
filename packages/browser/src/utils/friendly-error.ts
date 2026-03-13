const ELEMENT_COUNT_REGEX = /resolved to (\d+) elements/;

export const toFriendlyError = (error: unknown, ref: string): Error => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("strict mode violation")) {
    const countMatch = ELEMENT_COUNT_REGEX.exec(message);
    const count = countMatch ? countMatch[1] : "multiple";
    return new Error(`Ref "${ref}" matched ${count} elements. Run snapshot to get updated refs.`);
  }

  if (message.includes("intercepts pointer events")) {
    return new Error(`Ref "${ref}" is blocked by an overlay. Dismiss any modals or banners first.`);
  }

  if (message.includes("not visible") && !message.includes("Timeout")) {
    return new Error(`Ref "${ref}" is not visible. Try scrolling it into view.`);
  }

  if (message.includes("Timeout") && message.includes("exceeded")) {
    return new Error(
      `Action on "${ref}" timed out. The element may be blocked or still loading. Run snapshot to check.`,
    );
  }

  if (message.includes("waiting for") && message.includes("to be visible")) {
    return new Error(
      `Ref "${ref}" not found or not visible. Run snapshot to see current page elements.`,
    );
  }

  return error instanceof Error ? error : new Error(message);
};
