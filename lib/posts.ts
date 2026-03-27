import "server-only";
import { cache } from "react";
import { connection } from "next/server";

export type Post = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
};

const AUTHORS = [
  "Alice Chen",
  "Marcus Rivera",
  "Priya Sharma",
  "James Okonkwo",
  "Sofia Lindgren",
];

const CATEGORIES = [
  "Engineering",
  "Design",
  "Product",
  "Culture",
  "Infrastructure",
  "Security",
  "Performance",
  "Open Source",
];

const SEED_POSTS: Omit<Post, "id" | "date">[] = [
  { title: "Rethinking Server Components in Production", excerpt: "After a year running React Server Components at scale, we share what surprised us—the wins, the gotchas, and how our architecture evolved.", author: AUTHORS[0], readTime: "8 min", category: "Engineering" },
  { title: "The Design System That Designs Itself", excerpt: "How we built a constraint-based token pipeline that generates dark mode, density variants, and responsive layouts from a single source of truth.", author: AUTHORS[2], readTime: "12 min", category: "Design" },
  { title: "Streaming Is the New Default", excerpt: "Why we moved every data-fetching boundary to streaming and how it cut our P95 latency by 40%.", author: AUTHORS[3], readTime: "6 min", category: "Performance" },
  { title: "Zero-Downtime Migrations at Scale", excerpt: "A practical walkthrough of our blue-green migration strategy for Postgres, including the tooling we open-sourced.", author: AUTHORS[1], readTime: "15 min", category: "Infrastructure" },
  { title: "What Product Engineers Actually Do", excerpt: "The role sits between design and platform engineering. Here's how we define it, hire for it, and structure teams around it.", author: AUTHORS[4], readTime: "7 min", category: "Product" },
  { title: "Auditing npm Dependencies You Forgot About", excerpt: "We found 23 abandoned packages in our dependency tree. Here's the automated pipeline we built to catch them.", author: AUTHORS[0], readTime: "9 min", category: "Security" },
  { title: "Why We Open-Sourced Our Internal CLI", excerpt: "The story behind releasing our developer toolchain to the community—and what we learned from the first 500 contributors.", author: AUTHORS[3], readTime: "5 min", category: "Open Source" },
  { title: "Building Culture Through Code Review", excerpt: "Code review is our highest-leverage culture tool. We share the norms, templates, and automation that make it work.", author: AUTHORS[4], readTime: "10 min", category: "Culture" },
  { title: "Partial Prerendering Changed Everything", excerpt: "Mixing static shells with dynamic slots let us serve instant pages without sacrificing personalization.", author: AUTHORS[1], readTime: "7 min", category: "Engineering" },
  { title: "A Color System for the Real World", excerpt: "OKLCH, perceptual uniformity, and the math behind accessible color palettes that actually look good.", author: AUTHORS[2], readTime: "11 min", category: "Design" },
  { title: "Taming WebSocket Reconnects", excerpt: "Our journey from naive retry loops to an exponential-backoff state machine with jitter and session resumption.", author: AUTHORS[0], readTime: "8 min", category: "Engineering" },
  { title: "Edge Caching Without the Footguns", excerpt: "Cache invalidation is hard. We share our tag-based purging strategy and the observability layer on top.", author: AUTHORS[3], readTime: "9 min", category: "Infrastructure" },
  { title: "The Metrics That Actually Matter", excerpt: "We threw out 80% of our dashboards. Here are the five signals we watch every day.", author: AUTHORS[4], readTime: "6 min", category: "Product" },
  { title: "CSP Headers in a Component World", excerpt: "Content Security Policy meets streaming HTML. A guide to nonce-based CSP with React Server Components.", author: AUTHORS[0], readTime: "10 min", category: "Security" },
  { title: "Contributing to Next.js: A First-Timer's Guide", excerpt: "Filing your first PR to a major framework is intimidating. Here's a map of the codebase and the maintainers' expectations.", author: AUTHORS[1], readTime: "8 min", category: "Open Source" },
  { title: "Remote Work Rituals That Stuck", excerpt: "After three years fully distributed, these are the async rituals our team actually kept.", author: AUTHORS[4], readTime: "5 min", category: "Culture" },
  { title: "Typed API Contracts End-to-End", excerpt: "From Zod schema to OpenAPI spec to generated client—zero runtime mismatch, zero manual sync.", author: AUTHORS[0], readTime: "12 min", category: "Engineering" },
  { title: "Motion Design for Developers", excerpt: "Spring physics, easing curves, and the perception of speed. A practical primer for engineers who want smoother UI.", author: AUTHORS[2], readTime: "9 min", category: "Design" },
  { title: "How We Cut Bundle Size by 60%", excerpt: "Tree-shaking, dynamic imports, and one surprising Webpack plugin that made the biggest difference.", author: AUTHORS[3], readTime: "7 min", category: "Performance" },
  { title: "Multi-Region Postgres: Lessons Learned", excerpt: "Running read replicas across three continents taught us about conflict resolution, latency budgets, and failure modes.", author: AUTHORS[1], readTime: "14 min", category: "Infrastructure" },
  { title: "Saying No to Features", excerpt: "The hardest product skill is subtraction. We share our framework for evaluating—and declining—feature requests.", author: AUTHORS[4], readTime: "6 min", category: "Product" },
  { title: "Supply Chain Attacks Are Getting Smarter", excerpt: "Typosquatting, install scripts, and compromised maintainers. A threat landscape review for 2026.", author: AUTHORS[0], readTime: "11 min", category: "Security" },
  { title: "Maintaining a 10,000-Star Repo", excerpt: "Issue triage, release cadence, and contributor burnout. The unglamorous side of popular open source.", author: AUTHORS[3], readTime: "8 min", category: "Open Source" },
  { title: "The Onboarding Doc Nobody Reads", excerpt: "We replaced our 40-page onboarding wiki with a CLI that sets up your dev environment in one command.", author: AUTHORS[4], readTime: "5 min", category: "Culture" },
  { title: "React Compiler: Six Months Later", excerpt: "We enabled the React compiler on our largest app. Here are the real-world perf numbers and the edge cases we hit.", author: AUTHORS[1], readTime: "10 min", category: "Engineering" },
  { title: "Designing for Information Density", excerpt: "Dashboard UI is a different discipline. We break down layout grids, data tables, and the art of showing more with less.", author: AUTHORS[2], readTime: "13 min", category: "Design" },
  { title: "Profiling Node.js in Production", excerpt: "Flame graphs, heap snapshots, and the hidden cost of closures. A field guide to finding your bottlenecks.", author: AUTHORS[0], readTime: "9 min", category: "Performance" },
  { title: "Kubernetes Without the Complexity", excerpt: "We abstracted away the YAML. Our internal platform now deploys services with a single config file.", author: AUTHORS[3], readTime: "8 min", category: "Infrastructure" },
  { title: "Feedback Loops in Product Development", excerpt: "Shorter loops, better products. We share how we tightened our cycle from idea to shipped feature to measured outcome.", author: AUTHORS[4], readTime: "7 min", category: "Product" },
  { title: "Secrets Management Done Right", excerpt: "Environment variables, vaults, and rotation policies. A pragmatic guide to not leaking your API keys.", author: AUTHORS[0], readTime: "10 min", category: "Security" },
  { title: "Our First RFC Process", excerpt: "How we introduced lightweight design docs for cross-team decisions—and avoided death by committee.", author: AUTHORS[1], readTime: "6 min", category: "Culture" },
  { title: "The Case for Monorepos in 2026", excerpt: "Turborepo, shared configs, and atomic commits. Why we consolidated 12 repos into one—and haven't looked back.", author: AUTHORS[3], readTime: "11 min", category: "Engineering" },
  { title: "Accessible Components From Scratch", excerpt: "ARIA, focus management, and screen reader testing. Building UI primitives that work for everyone.", author: AUTHORS[2], readTime: "14 min", category: "Design" },
  { title: "Image Optimization Beyond next/image", excerpt: "AVIF, responsive art direction, and lazy-loading patterns that shaved 2 seconds off our LCP.", author: AUTHORS[0], readTime: "8 min", category: "Performance" },
  { title: "Observability-Driven Development", excerpt: "We write the dashboard before the feature. How observability-first thinking changed our engineering culture.", author: AUTHORS[3], readTime: "7 min", category: "Infrastructure" },
  { title: "Pricing Page Lessons", excerpt: "After 14 iterations, here's what we learned about pricing tiers, feature gates, and the psychology of the middle option.", author: AUTHORS[4], readTime: "9 min", category: "Product" },
  { title: "CORS, Cookies, and Credential Confusion", excerpt: "A deep dive into the most misunderstood headers on the web and how to configure them without trial and error.", author: AUTHORS[0], readTime: "10 min", category: "Security" },
  { title: "Sponsoring Open Source Sustainably", excerpt: "We allocate 1% of revenue to open-source maintainers. Here's our selection process and impact report.", author: AUTHORS[1], readTime: "5 min", category: "Open Source" },
  { title: "Writing Good Error Messages", excerpt: "Users read errors when they're stuck. We audited 200 error strings and rewrote them with empathy and clarity.", author: AUTHORS[2], readTime: "6 min", category: "Design" },
  { title: "Server Actions for Complex Forms", excerpt: "Multi-step wizards, optimistic updates, and file uploads. Patterns for forms that go beyond the happy path.", author: AUTHORS[0], readTime: "12 min", category: "Engineering" },
  { title: "CDN Architecture for Global Apps", excerpt: "How we route requests across 40 edge locations with intelligent failover and origin shielding.", author: AUTHORS[3], readTime: "10 min", category: "Infrastructure" },
  { title: "Reducing Decision Fatigue in UI", excerpt: "Smart defaults, progressive disclosure, and the art of doing less so users can do more.", author: AUTHORS[2], readTime: "7 min", category: "Design" },
  { title: "TypeScript 5.8: What We're Excited About", excerpt: "Isolated declarations, decorator metadata, and the features that will change how we write types.", author: AUTHORS[1], readTime: "8 min", category: "Engineering" },
  { title: "Load Testing With Real Traffic Patterns", excerpt: "Synthetic benchmarks lie. We replay production traffic at 10x scale to find real breaking points.", author: AUTHORS[0], readTime: "9 min", category: "Performance" },
  { title: "Platform Engineering Is Not DevOps", excerpt: "Internal developer platforms, golden paths, and why the distinction matters for your org structure.", author: AUTHORS[3], readTime: "7 min", category: "Infrastructure" },
  { title: "User Research on a Budget", excerpt: "Five-person usability tests, session recordings, and the survey questions that yield real insights.", author: AUTHORS[4], readTime: "6 min", category: "Product" },
  { title: "Rate Limiting Strategies Compared", excerpt: "Token bucket, sliding window, and leaky bucket. We benchmark each algorithm under bursty traffic.", author: AUTHORS[0], readTime: "11 min", category: "Security" },
  { title: "Forking vs. Contributing Upstream", excerpt: "When to maintain your own fork and when to invest in getting changes merged. A decision framework.", author: AUTHORS[1], readTime: "8 min", category: "Open Source" },
  { title: "Pair Programming Across Time Zones", excerpt: "Async pairing, recorded walkthroughs, and the tools that make cross-timezone collaboration feel synchronous.", author: AUTHORS[4], readTime: "5 min", category: "Culture" },
  { title: "What We Shipped in 2025", excerpt: "A retrospective on the features, infrastructure changes, and team milestones that defined our year.", author: AUTHORS[4], readTime: "15 min", category: "Product" },
];

const TOTAL_POSTS = 200;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MOCK_POSTS: Post[] = Array.from({ length: TOTAL_POSTS }, (_, i) => {
  const seed = SEED_POSTS[i % SEED_POSTS.length];
  const date = new Date(2026, 2, 25);
  date.setDate(date.getDate() - i * 2);
  return {
    id: String(i + 1),
    title: seed.title,
    excerpt: seed.excerpt,
    author: AUTHORS[i % AUTHORS.length],
    date: formatDate(date),
    readTime: seed.readTime,
    category: CATEGORIES[i % CATEGORIES.length],
  };
});

export type PostsPage = {
  posts: Post[];
  nextCursor: number | null;
};

const DEFAULT_PAGE_SIZE = 20;

export const getPostsPage = cache(
  async (cursor: number = 0, limit: number = DEFAULT_PAGE_SIZE): Promise<PostsPage> => {
    await connection();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const start = cursor;
    const end = start + limit;
    const posts = MOCK_POSTS.slice(start, end);
    const nextCursor = end < MOCK_POSTS.length ? end : null;

    return { posts, nextCursor };
  },
);
