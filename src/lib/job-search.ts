/** Compatibility shim: Job Search now uses public board APIs in @/lib/jobs. */
export type JobResult = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  postedAt: string | null;
  postedAtMs: number | null;
  portal: string;
  applicationUrl: string;
  summary: string;
};
