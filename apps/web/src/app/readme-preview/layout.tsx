import { ReadmePreviewSidebar } from "@/components/readme-preview/readme-preview-sidebar";

export const metadata = {
  title: "SwarAI — README preview",
  robots: { index: false, follow: false },
};

export default function ReadmePreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <ReadmePreviewSidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
