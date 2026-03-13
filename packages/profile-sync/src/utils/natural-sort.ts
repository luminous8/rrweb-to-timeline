const extractLeadingNumber = (value: string): number => {
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export const naturalCompare = (left: string, right: string): number => {
  const leftNumber = extractLeadingNumber(left);
  const rightNumber = extractLeadingNumber(right);
  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
};
