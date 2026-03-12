import { useCallback, useMemo, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { BRANCH_COUNT, COLORS, LOCAL_BRANCH_INDEX, MENU_OPTIONS, SEARCH_PLACEHOLDER } from "./constants";
import { generateBranches } from "./utils/generate-branches";

interface LocalBranchScreenProps {
  onSelect: (branch: string) => void;
}

export const LocalBranchScreen = ({ onSelect }: LocalBranchScreenProps) => {
  const option = MENU_OPTIONS[LOCAL_BRANCH_INDEX];
  const [searchQuery, setSearchQuery] = useState("");
  const [branches] = useState(() => generateBranches(BRANCH_COUNT));
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredBranches = useMemo(() => {
    if (!searchQuery) return branches;
    const lower = searchQuery.toLowerCase();
    return branches.filter((branch) => branch.toLowerCase().includes(lower));
  }, [branches, searchQuery]);

  const handleInput = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setHighlightedIndex(0);
    },
    [],
  );

  useKeyboard((key) => {
    if (key.name === "down") {
      setHighlightedIndex((previous) => Math.min(filteredBranches.length - 1, previous + 1));
    }
    if (key.name === "up") {
      setHighlightedIndex((previous) => Math.max(0, previous - 1));
    }
    if (key.name === "return" && filteredBranches.length > 0) {
      onSelect(filteredBranches[highlightedIndex]);
    }
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={COLORS.BACKGROUND}
      paddingX={2}
      paddingY={1}
    >
      <text fg={COLORS.TEXT}>
        <b>{`${LOCAL_BRANCH_INDEX + 1}. ${option.label}`}</b>
        <span fg={COLORS.DIM}>{` (${filteredBranches.length})`}</span>
      </text>

      <box
        marginTop={1}
        height={1}
        width="100%"
        border={["top"]}
        borderColor={COLORS.DIVIDER}
        borderStyle="single"
      />

      <box flexDirection="column" marginTop={1} gap={0}>
        {filteredBranches.map((branch, index) => (
          <text key={index} fg={index === highlightedIndex ? COLORS.SELECTION : COLORS.TEXT}>
            {index === highlightedIndex ? `> ${branch}` : `  ${branch}`}
          </text>
        ))}
        {filteredBranches.length === 0 && <text fg={COLORS.DIM}>No matching branches</text>}
      </box>

      <box
        marginTop={2}
        width="80%"
        border
        borderStyle="rounded"
        borderColor={COLORS.BORDER}
        paddingX={2}
      >
        <input
          focused
          width="100%"
          textColor={COLORS.TEXT}
          placeholder={SEARCH_PLACEHOLDER}
          value={searchQuery}
          onInput={handleInput}
        />
      </box>

      <text fg={COLORS.DIM} marginTop={1}>
        ↑/↓ to navigate · Enter to select · Esc to go back
      </text>
    </box>
  );
};
