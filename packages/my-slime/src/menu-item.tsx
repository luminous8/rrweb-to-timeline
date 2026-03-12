import { COLORS, SELECTED_INDICATOR } from "./constants";

interface MenuItemProps {
  index: number;
  label: string;
  detail: string;
  isSelected: boolean;
}

export const MenuItem = ({ index, label, detail, isSelected }: MenuItemProps) => {
  const number = `${index + 1}.`;

  if (isSelected && index === 0) {
    return (
      <text fg={COLORS.TEXT}>
        <span fg={COLORS.SELECTION}>{SELECTED_INDICATOR} </span>
        <span>{number} </span>
        <span fg={COLORS.SELECTION}>{label}</span>
        <span fg={COLORS.TEXT}> [ </span>
        <span fg={COLORS.GREEN}>+44</span>
        <span fg={COLORS.TEXT}> </span>
        <span fg={COLORS.RED}>-23</span>
        <span fg={COLORS.TEXT}> · 2 files ]</span>
      </text>
    );
  }

  if (isSelected) {
    return (
      <text fg={COLORS.TEXT}>
        <span fg={COLORS.SELECTION}>{SELECTED_INDICATOR} </span>
        <span>{number} </span>
        <span fg={COLORS.SELECTION}>{label}</span>
        {detail ? <span fg={COLORS.DIM}> {detail}</span> : null}
      </text>
    );
  }

  return (
    <text fg={COLORS.TEXT}>
      <span>{"  "}</span>
      <span>{number} </span>
      <span>{label}</span>
      {detail ? <span fg={COLORS.DIM}> {detail}</span> : null}
    </text>
  );
};
