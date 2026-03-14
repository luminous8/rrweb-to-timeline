import type { DOMElement } from "ink";

export interface CollectedNode {
  node: DOMElement;
  depth: number;
  tagName: string;
}

const isDOMElement = (node: unknown): node is DOMElement =>
  node !== null &&
  typeof node === "object" &&
  "nodeName" in node &&
  "childNodes" in node &&
  Array.isArray((node as DOMElement).childNodes);

const walkTree = (node: DOMElement, depth: number, result: CollectedNode[]): void => {
  const tagName = node.nodeName ?? "";
  if (tagName && tagName !== "ink-root") {
    result.push({ node, depth, tagName });
  }

  for (const child of node.childNodes) {
    if (isDOMElement(child)) {
      walkTree(child, depth + 1, result);
    }
  }
};

export const collectNodes = (root: DOMElement): CollectedNode[] => {
  const result: CollectedNode[] = [];
  walkTree(root, 0, result);
  return result;
};
