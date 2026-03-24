export const ProjectInfo = () => {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-medium tracking-tight">expect</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Expect lets coding agents test your code changes in a real browser.
      </p>
      <span className="text-sm leading-relaxed text-muted-foreground">
        Describe what to test → an agent handles the rest.
      </span>
    </div>
  );
};
