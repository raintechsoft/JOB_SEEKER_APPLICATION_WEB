import type {Metadata} from "next";
import {Suspense} from "react";
import {notFound, redirect} from "next/navigation";
import {z} from "zod";
import {ApplicationWizardScreen} from "@/features/applications/application-wizard-screen";
import {ApplicationWizardSkeleton} from "@/features/applications/application-wizard-skeleton";

export const metadata: Metadata = {title:"Apply for a job", robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{jobId:string}>}) {
  const {jobId} = await params;
  if (!z.uuid().safeParse(jobId).success) notFound();
  // Keep direct page entry consistent with the deployment's shared Apply switch.
  if (process.env.NEXT_PUBLIC_APPLICATION_WIZARD_ENABLED !== "true") redirect(`/jobs/${jobId}`);
  return <Suspense fallback={<ApplicationWizardSkeleton/>}><ApplicationWizardScreen jobId={jobId}/></Suspense>;
}
