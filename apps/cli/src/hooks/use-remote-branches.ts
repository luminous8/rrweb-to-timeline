import { useQuery } from "@tanstack/react-query";
import type { RemoteBranch } from "@expect/shared/models";
import { fetchRemoteBranches } from "../utils/context-options.js";

export const useRemoteBranches = () =>
  useQuery({
    queryKey: ["remote-branches"],
    queryFn: (): Promise<RemoteBranch[]> => fetchRemoteBranches(process.cwd()),
  });
