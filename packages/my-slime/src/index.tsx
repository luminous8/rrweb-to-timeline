import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";

const start = async () => {
  const renderer = await createCliRenderer();
  createRoot(renderer).render(<App />);
};

start();
