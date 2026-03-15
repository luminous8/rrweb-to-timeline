import { Text } from "ink";
import { useColors } from "../theme-context.js";

interface MenuItemProps {
  label: string;
  detail: string;
  isSelected: boolean;
}

export const MenuItem = ({ label, detail, isSelected }: MenuItemProps) => {
  const COLORS = useColors();

  if (isSelected) {
    return (
      <Text>
        <Text color={COLORS.PRIMARY}>{"▸ "}</Text>
        <Text color={COLORS.PRIMARY} bold>
          {label}
        </Text>
        {detail ? <Text color={COLORS.DIM}> {detail}</Text> : null}
      </Text>
    );
  }

  return (
    <Text>
      <Text color={COLORS.DIM}>{"  "}</Text>
      <Text color={COLORS.DIM}>{label}</Text>
      {detail ? <Text color={COLORS.DIM}> {detail}</Text> : null}
    </Text>
  );
};
