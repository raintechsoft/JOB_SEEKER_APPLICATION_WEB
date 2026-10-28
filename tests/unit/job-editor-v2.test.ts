import { expect, it } from "vitest";
import { validJob } from "../fixtures/job";
import { jobValuesToV2 } from "@/lib/domain/job-v2-compatibility";
import { jobEditorValues, jobEditorPayload, jobEditorErrors } from "@/lib/domain/job-editor";
import { formatCompensation } from "@/lib/domain/job-compensation";
import { draftJobFromBrief } from "@/lib/domain/job-draft-generator";
it("round trips monthly pay, unknown vacancies and minimum-only experience without annual conversion", () => {
  const v = jobValuesToV2(validJob, "legacy-draft");
  v.compensation.period = "month"; v.compensation.minAmount = "25000.25"; v.compensation.maxAmount = "30000.50";
  v.experienceMax = null; v.vacancies = null;
  const editor = jobEditorValues(v);
  expect(jobEditorPayload(editor)).toEqual(v);
  expect(jobEditorErrors(editor, "publish")).toEqual({});
  expect(formatCompensation(v.compensation)).toContain("per month");
});
it("blocks conditional missing pay and invalid numbers locally and redacts hidden components", () => {
  const v = jobValuesToV2(validJob, "legacy-draft");
  v.compensation.format = "fixed"; v.compensation.maxAmount = null; v.compensation.minAmount = null;
  const editor = jobEditorValues(v);
  expect(jobEditorErrors(editor, 0)).toHaveProperty("compensation.minAmount");
  expect(jobEditorErrors({...editor, vacancies: "0"}, "draft")).toHaveProperty("vacancies");
  expect(formatCompensation({...v.compensation, hidden:true, notes:"private"})).toBe("Compensation not disclosed");
});

import displayCases from "../../../../contracts/examples/job-compensation-display.json";
import { compensationV2Schema } from "@/lib/validation/job-v2";
it.each(displayCases)("shares compensation display: $name", sample=>expect(formatCompensation(compensationV2Schema.parse(sample.compensation))).toBe(sample.label));
it("keeps monthly pay and open-ended experience truthful in generated job text",()=>{
  const c=jobValuesToV2(validJob,"legacy-draft").compensation;c.kind="stipend";c.period="month";c.minAmount="18000.00";c.maxAmount="22000.00";
  const brief={role:"Engineer",location:"Chennai",arrangement:"Hybrid",employment:"Apprenticeship",currency:"INR" as const,skills:"PHP",experienceMin:"1",experienceMax:"",salaryMin:"",salaryMax:"",hideSalary:false,compensation:c};
  const result=draftJobFromBrief(brief);
  expect(result.description).toContain("per month");expect(result.description).not.toContain("annual salary");expect(result.requirements).toContain("At least 1 years");
  expect(draftJobFromBrief({...brief,hideSalary:true,compensation:{...c,hidden:true}}).description).not.toContain("18000");
});
