import { useState } from "react";
import { SearchApp } from "@/components/search-app";
import type { Job } from "@/lib/jobs";

type Props = {
  running: boolean;
  onSendToInputs: (job: { title: string; applicationUrl: string }) => void;
  resumeHtml?: string;
  setResumeHtml?: (v: string) => void;
  apiKey?: string;
  searchApiKey?: string;
  onPickFile?: (file: File | undefined) => void;
};

export function JobSearchPanel({ running, onSendToInputs }: Props) {
  const [query, setQuery] = useState("");

  function onSend(job: Job) {
    if (!job.url.startsWith("https://")) return;
    onSendToInputs({ title: job.title, applicationUrl: job.url });
  }

  return (
    <SearchApp query={query} onQuery={setQuery} onSend={onSend} sendDisabled={running} />
  );
}
