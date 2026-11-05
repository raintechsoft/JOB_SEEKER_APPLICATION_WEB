import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import type { ReviewView } from "@/services/recruiting/recruiting.service";
import { ReviewEditor } from "../review-dialog";

vi.mock("next/navigation", () => ({ usePathname: () => "/recruiter/applications", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
    void _prefetch;
    return <a href={String(href)} {...props}>{children}</a>;
  },
}));

const base: ReviewView = {
  application: {
    id: "a1",
    job: "job-1",
    candidate: "c1",
    createdAt: "2026-10-01T10:00:00.000Z",
    email: "asha.rao@example.test",
    note: "I led the migration of a legacy monolith to React.",
    portfolio: false,
    status: "New",
    recruiterNote: "",
    followUp: "",
    viewedAt: "",
    version: 1,
    recruitmentDetails: { location: "Pune", locality: "Baner", noticeDays: "30", joiningDays: "0", preferredLocations: "Pune, Bengaluru", phone: "+919876543210" },
    screeningAnswers: [
      { id: "q1", question: "Years with React in production?", answer: "4" },
      { id: "q2", question: "Willing to relocate to Bengaluru?", answer: "yes" },
    ],
  },
  person: { id: "c1", name: "Asha Rao", headline: "Frontend Engineer" },
  jobTitle: "Senior Engineer",
};

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});

function mount(data: ReviewView) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const services = { auth: { inspect: vi.fn(async () => null), me: vi.fn(async () => null) }, applications: {}, recruiting: {} } as unknown as Services;
  return render(
    <QueryClientProvider client={client}>
      <ServicesContext.Provider value={services}>
        <ReviewEditor initialData={data} />
      </ServicesContext.Provider>
    </QueryClientProvider>,
  );
}

const fact = (label: string) => {
  const span = [...document.querySelectorAll(".review-application-row > span")].find((el) => el.textContent === label);
  return span?.nextElementSibling as HTMLElement;
};

describe("ReviewEditor application details", () => {
  it("shows the submission-time profile fields the table shows", () => {
    mount({
      ...base,
      profile: {
        id: "c1", name: "Asha Rao", headline: "Frontend Engineer", summary: "", skills: ["React", "TypeScript"], email: "asha.rao@example.test",
        location: "Pune", locality: "Baner", years: 5, expectedSalary: null, notice: 30, joining: 0, industry: "", designation: "", department: "",
        educationText: "B.Tech Computer Science · IIT Madras", currentRole: "", previousRole: "", preferredLocations: "Pune, Bengaluru", phone: "+919876543210",
      },
      sharing: {
        schemaVersion: 2, expectedCompensation: null, verification: { email: true, phone: true },
        attachments: [{ id: "f1", kind: "resume", name: "asha-rao.pdf", mime: "application/pdf", size: 10, downloadPath: "/files/f1" }], portfolio: null,
      } as unknown as ReviewView["sharing"],
    });
    expect(fact("Email")).toHaveTextContent("asha.rao@example.test");
    expect(fact("Phone")).toHaveTextContent("+919876543210");
    expect(fact("Location")).toHaveTextContent("Pune · Baner");
    expect(fact("Notice period")).toHaveTextContent("30 days");
    expect(fact("Can join in")).toHaveTextContent("Immediate");
    expect(fact("Preferred locations")).toHaveTextContent("Pune, Bengaluru");
    expect(fact("Experience")).toHaveTextContent("5 years");
    expect(fact("Education")).toHaveTextContent("B.Tech Computer Science · IIT Madras");
    expect(fact("Skills")).toHaveTextContent("React");
    expect(fact("Skills")).toHaveTextContent("TypeScript");
    expect(screen.getByText("I led the migration of a legacy monolith to React.")).toBeInTheDocument();
    const answers = screen.getByRole("heading", { name: "Screening answers" }).parentElement as HTMLElement;
    expect(within(answers).getByText("Years with React in production?").parentElement).toHaveTextContent("4");
    expect(within(answers).getByText("Willing to relocate to Bengaluru?").parentElement).toHaveTextContent("Yes");
    // The resume is reviewed from the responses list, not from this sheet.
    expect(screen.queryByText(/Resume · /)).toBeNull();
  });

  it("falls back to the raw recruitment details", () => {
    mount(base);
    expect(fact("Email")).toHaveTextContent("asha.rao@example.test");
    expect(fact("Phone")).toHaveTextContent("+919876543210");
    expect(fact("Can join in")).toHaveTextContent("Immediate");
    expect(fact("Notice period")).toHaveTextContent("30 days");
    expect(fact("Education")).toHaveTextContent("Not provided");
    expect(fact("Education")).toHaveClass("is-empty");
  });
});
