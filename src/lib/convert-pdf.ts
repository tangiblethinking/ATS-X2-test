import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { stripMarkdownFences } from "@/lib/html-clean";
import { MAX_RESUME_CHARS } from "@/lib/pipeline-types";
import resumeTemplateHtml from "@/lib/resume-template.html?raw";

const apiKeySchema = z
  .string()
  .trim()
  .min(20, "Enter a valid API key.")
  .refine((v) => !/\s/.test(v), "The API key cannot contain spaces.");

const MAX_PDF_BASE64 = 12_000_000;

export const convertPdfToHtml = createServerFn({ method: "POST" })
  .validator(
    z.object({
      apiKey: apiKeySchema,
      pdfBase64: z
        .string()
        .min(100, "PDF data is missing.")
        .max(MAX_PDF_BASE64, "PDF is too large (max ~9MB)."),
    }),
  )
  .handler(async ({ data }) => {
    const { geminiChatWithPdf } = await import("./gemini.server");
    const system = `You convert PDF resumes into complete standalone HTML documents.
You MUST follow the LAYOUT, CSS, structure, section patterns, and visual theme of the TEMPLATE HTML provided in the user message.
CRITICAL RULES:
1. Output a completely NEW resume. Do NOT copy any personal data, names, employers, dates, bullets, skills, education, or contact details from the TEMPLATE. The template is layout-only.
2. Extract all information from the uploaded PDF only.
3. Map content into the same section types the template uses when possible: header, Summary, Experience, Key Achievements, Skills, Education & Certifications.
4. Any information from the PDF that does not fit those categories MUST become NEW sections reusing the same visual theme.
5. Preserve the template CSS variables, fonts, class names, and page structure.
6. Return ONLY the full HTML document. No markdown fences, no commentary.
7. Stay truthful to the PDF. Do not invent employers, metrics, or skills.`;

    const userText = `Convert the attached PDF resume into HTML.

TEMPLATE HTML (layout/CSS/theme ONLY — discard sample content):
${resumeTemplateHtml}

Parse the PDF. Fill template structure with PDF content. Put unmatched content in new sections using the same styling. Return only complete HTML.`;

    const result = await geminiChatWithPdf({
      apiKey: data.apiKey,
      system,
      userText,
      pdfBase64: data.pdfBase64,
      maxTokens: 8192,
      temperature: 0.15,
    });
    if (!result.ok) return result;
    const html = stripMarkdownFences(result.text);
    if (html.length < 80 || !/<\/?html/i.test(html)) {
      return { ok: false as const, error: "PDF conversion did not return valid HTML." };
    }
    if (html.length > MAX_RESUME_CHARS) {
      return { ok: false as const, error: "Generated HTML is too large." };
    }
    return { ok: true as const, html };
  });
