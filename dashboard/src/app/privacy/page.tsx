import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | BrainWeb",
  description:
    "How BrainWeb handles your data: local-only tracking statistics, no accounts, and no transmission of your activity to BrainWeb servers.",
};

const sections = [
  {
    title: "What BrainWeb is",
    body: [
      "BrainWeb is a Chrome extension that tracks content consumption and active time on X and LinkedIn. It helps you understand your attention and digital habits through a local dashboard.",
      "While you browse supported sites, BrainWeb observes relevant page elements to classify content — for example, whether a post contains video, images, articles, or text, and whether it is sponsored or organic. It also measures how long a focused, recently active tab is in use.",
    ],
  },
  {
    title: "What data BrainWeb processes",
    body: [
      "BrainWeb processes the following information entirely on your device:",
      "Post counts, content classifications (text, video, article, image), sponsored and organic counts, and active-time statistics, aggregated per platform and per day.",
      "To classify whether a post is sponsored, BrainWeb checks the text of specific sponsored/promoted disclosure labels shown by X and LinkedIn. It does not read or store the actual body text of posts, images, videos, or other page content — only counts and classifications derived from page elements.",
    ],
  },
  {
    title: "Where your data is stored",
    body: [
      "All tracking statistics are stored locally in your browser using chrome.storage.local, within your browser profile on your device.",
      "Separately from the main statistics, BrainWeb temporarily stores hashed post identifiers in the tab's sessionStorage to avoid counting the same post twice. This deduplication data is not part of your statistics and is cleared automatically when the tab closes.",
      "To generate those hashed identifiers, the extension may temporarily access X post URLs in the page. Raw post URLs are not stored or transmitted to BrainWeb servers.",
      "Statistics are not synchronized across devices, browsers, or profiles. Each installation keeps its own independent local records.",
    ],
  },
  {
    title: "What BrainWeb does not do",
    body: [
      "BrainWeb does not transmit your tracking statistics, post content, browsing history, or visited URLs to BrainWeb's own servers.",
      "BrainWeb does not require an account, email address, or any registration.",
      "BrainWeb does not share tracking statistics with advertisers, data brokers, or third parties for marketing purposes.",
      "BrainWeb does not collect analytics telemetry about your usage of the extension itself.",
    ],
  },
  {
    title: "The BrainWeb dashboard",
    body: [
      "The BrainWeb dashboard retrieves your statistics directly from the extension through Chrome extension messaging. The dashboard displays the data in your browser; it does not upload your statistics anywhere.",
      "The dashboard website is hosted by Vercel. Like most hosting providers, Vercel processes ordinary server request logs (such as IP addresses and requested URLs) to deliver and secure the website. BrainWeb does not send your tracking statistics to Vercel or to any analytics service.",
    ],
  },
  {
    title: "Your control over the data",
    body: [
      "You can pause or resume tracking at any time from the extension popup, and you can clear all locally stored statistics from the dashboard's settings.",
      "Uninstalling the extension, or clearing the extension's storage in your browser settings, permanently removes the locally stored statistics from your device.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-10 text-[var(--text)]">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mb-10">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--green)]"
          >
            ← Back to BrainWeb
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            BrainWeb is designed so that your attention data stays on your
            device. This policy explains exactly what the extension processes
            and where it goes.
          </p>
        </header>

        <div className="grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[11px] border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <h2 className="mb-3 text-sm font-semibold text-[#e4e9e9]">
                {section.title}
              </h2>
              <div className="grid gap-3">
                {section.body.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-[13px] leading-6 text-[var(--muted)]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-[var(--border)] pt-6 text-center text-[11px] text-[var(--muted-2)]">
          BrainWeb — privacy-first content consumption and active-time
          tracker for X and LinkedIn.
        </footer>
      </article>
    </main>
  );
}
