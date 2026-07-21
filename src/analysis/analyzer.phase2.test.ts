import { describe, it, expect } from "vitest";
import { analyzeCode } from "./analyzer";

describe("Phase 2 — React / Next / bundle / SEO / CWV static rules", () => {
  it("detects getServerSideProps export", () => {
    const code = `export async function getServerSideProps() { return { props: {} }; }
export default function P() { return null; }`;
    const res = analyzeCode(code);
    expect(res.issues.some((i) => i.type === "next-ssr-gssp")).toBe(true);
    expect(res.metrics.seoReadiness).toBeDefined();
  });

  it("detects default lodash import", () => {
    const code = `import _ from "lodash";
export default function X() { return null; }`;
    const res = analyzeCode(code);
    expect(res.issues.some((i) => i.type === "bundle-lodash")).toBe(true);
  });

  it("flags missing title when next/head is used", () => {
    const code = `import Head from "next/head";
export default function Page() {
  return <Head><meta name="x" content="y" /></Head>;
}`;
    const res = analyzeCode(code);
    expect(res.issues.some((i) => i.type === "seo-next-head-title")).toBe(true);
  });

  it("does not flag when title is present", () => {
    const code = `import Head from "next/head";
export default function Page() {
  return <Head><title>Hi</title></Head>;
}`;
    const res = analyzeCode(code);
    expect(res.issues.some((i) => i.type === "seo-next-head-title")).toBe(false);
  });

  it("detects web img without dimensions", () => {
    const code = `export default function P() { return <img src="/a.png" alt="x" />; }`;
    const res = analyzeCode(code);
    expect(res.issues.some((i) => i.type === "cwv-img-layout")).toBe(true);
  });

  it("detects dangerouslySetInnerHTML", () => {
    const code = `export default function P() { return <div dangerouslySetInnerHTML={{ __html: "<b>x</b>" }} />; }`;
    const res = analyzeCode(code);
    expect(res.issues.some((i) => i.type === "react-unsafe-html")).toBe(true);
  });
});
