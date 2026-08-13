import { createServerFn } from "@tanstack/react-start";
import { loadLiveFeed } from "@/lib/analytics.server";
import { getRequestAuth } from "@/lib/request-auth.server";

export const getLiveFeed = createServerFn({ method: "GET" })
  .handler(async () => {
    const context = await getRequestAuth();
    return loadLiveFeed(context);
  });