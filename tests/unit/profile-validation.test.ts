import { expect, it } from "vitest";
import { profileSectionSchema, profileRecordSchema, profileFieldsSchema, profileDuplicate, validateMedia,mediaRules } from "@/lib/validation/profile";

it("rejects reversed dates, unsafe links, empty lists, duplicate skills and invalid optional numbers", () => {
  expect(profileRecordSchema("employment").safeParse({ title: "Engineer", company: "Acme", start: "2025-03", end: "2024-01", current: false }).success).toBe(false);
  expect(profileRecordSchema("onlineProfiles").safeParse({ title: "Profile", url: "javascript:alert(1)" }).success).toBe(false);
  expect(profileFieldsSchema({roles:"listtext"}).safeParse({ roles: " , , " }).success).toBe(false);
  expect(profileSectionSchema("career").safeParse({ salary: "", currency: "" }).success).toBe(true);
  expect(profileSectionSchema("career").safeParse({ salary: "100", currency: "" }).success).toBe(false);
  expect(profileDuplicate("skills", { id: "", name: " PHP " }, [{ id: "one", name: "php" }])).toBe(true);
  expect(profileRecordSchema("skills").safeParse({ name: "PHP", years: "NaN" }).success).toBe(false);
});
it("validates calendar dates, current employment and Unicode length", () => {
  expect(profileSectionSchema("personal").safeParse({ dob: "2025-02-31" }).success).toBe(false);
  expect(profileRecordSchema("employment").safeParse({ title: "Engineer", company: "Acme", start: "2025-03", current: true }).success).toBe(true);
  expect(profileRecordSchema("skills").safeParse({ name: "🧑".repeat(100) }).success).toBe(true);
  expect(profileRecordSchema("skills").safeParse({ name: "🧑".repeat(101) }).success).toBe(false);
});
it("rejects invalid/oversized media before any upload and accepts the documented resume boundary", () => {
  expect(validateMedia(new File(["bad"], "bad.svg", { type: "image/svg+xml" }), "portrait")).toBeTruthy();
  const file=new File(["pdf"],"resume.pdf",{type:"application/pdf"});
  Object.defineProperty(file,'size',{value:mediaRules.resume.max+1,configurable:true});expect(validateMedia(file,'resume')).toBeTruthy();
  Object.defineProperty(file,'size',{value:mediaRules.resume.max});expect(validateMedia(file,'resume')).toBeNull();
});
