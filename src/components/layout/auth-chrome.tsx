import Image from "next/image";
import { Brand } from "@/components/ui/primitives";
import { EmployerMenu } from "./public-chrome";

export function AuthHeader() {
  return (
    <header className="auth-workspace-header">
      <Brand />
      <EmployerMenu variant="auth" />
    </header>
  );
}

export function AuthStory({ employer = false }: { employer?: boolean }) {
  return (
    <aside className="auth-story" aria-label={(employer ? "Employer" : "Professional") + " introduction"}>
      <span className="eyebrow">{employer ? "GOOD WORK. GOOD PEOPLE." : "YOUR WORK. YOUR STORY."}</span>
      <h1>
        {employer ? "Your next great hire" : "There’s more to you"}
        <br /> {employer ? "starts here." : "than a resume."}
      </h1>
      <figure className="auth-role-illustration">
        <Image
          src={employer ? "/images/illustrations/employer-hiring.png" : "/images/illustrations/job-seeker-journey.png"}
          alt={employer ? "Recruiter reviewing candidate profiles with a job seeker" : "Job seeker stepping toward new opportunities with a portfolio"}
          width={employer ? 1199 : 1227}
          height={employer ? 1312 : 1282}
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 850px) 80vw, 40vw"
        />
      </figure>
    </aside>
  );
}
