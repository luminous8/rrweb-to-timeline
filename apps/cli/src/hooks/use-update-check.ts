import { Effect, Exit, Schema } from "effect";
import { useQuery } from "@tanstack/react-query";
import {
  NPM_PACKAGE_NAME,
  UPDATE_CHECK_STALE_MS,
  UPDATE_CHECK_TIMEOUT_MS,
  VERSION,
} from "../constants";

const NpmLatestResponse = Schema.Struct({
  version: Schema.String,
});

const isNewerVersion = (latest: string, current: string): boolean => {
  const latestParts = latest.split(".").map(Number);
  const currentParts = current.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if ((latestParts[index] ?? 0) > (currentParts[index] ?? 0)) return true;
    if ((latestParts[index] ?? 0) < (currentParts[index] ?? 0)) return false;
  }
  return false;
};

const fetchLatestVersion = Effect.gen(function* () {
  const json = yield* Effect.tryPromise({
    try: () =>
      fetch(`https://registry.npmjs.org/${NPM_PACKAGE_NAME}/latest`).then((response) =>
        response.json(),
      ),
    catch: (cause) => new Error(`npm registry fetch failed: ${cause}`),
  });
  const response = yield* Effect.try({
    try: () => Schema.decodeUnknownSync(NpmLatestResponse)(json),
    catch: (cause) => new Error(`npm response decode failed: ${cause}`),
  });
  return response.version;
}).pipe(
  Effect.timeoutOrElse({
    duration: UPDATE_CHECK_TIMEOUT_MS,
    onTimeout: () => Effect.succeed(undefined),
  }),
);

interface UpdateCheckResult {
  latestVersion: string | undefined;
  updateAvailable: boolean;
}

export const useUpdateCheck = (): UpdateCheckResult => {
  const { data: latestVersion } = useQuery({
    queryKey: ["update-check"],
    queryFn: async (): Promise<string | undefined> => {
      const exit = await Effect.runPromiseExit(fetchLatestVersion);
      if (Exit.isSuccess(exit)) return exit.value;
      return undefined;
    },
    staleTime: UPDATE_CHECK_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateAvailable = latestVersion !== undefined && isNewerVersion(latestVersion, VERSION);

  return { latestVersion, updateAvailable };
};
