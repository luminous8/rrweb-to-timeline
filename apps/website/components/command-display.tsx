"use client";

import { useState } from "react";
import { ClipboardCopy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COPY_FEEDBACK_DURATION_MS } from "@/constants";

const TAB_TEXT: Record<string, string> = {
  command: "npx expect@latest",
  agent: "npx -y expect@latest -m 'test my current changes' -y",
  skill: "npx skills add millionco/expect/expect-cli",
};

export const CommandDisplay = () => {
  const [activeTab, setActiveTab] = useState("command");
  const [copied, setCopied] = useState(false);
  const commandText = TAB_TEXT[activeTab] ?? "";

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCopied(false);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(commandText);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList variant="line">
          <TabsTrigger value="command">Command</TabsTrigger>
          <TabsTrigger value="skill">Install skill</TabsTrigger>
          <TabsTrigger value="agent">Agent prompt</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center justify-between pt-0.5 pb-2.25">
        <code className="font-mono text-sm">{commandText}</code>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={copyCommand}
                aria-label="Copy command"
                className="text-muted-foreground"
              />
            }
          >
            {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : "Copy to clipboard"}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
