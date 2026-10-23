import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";

const passwordCharacters = (value: string) => !value.includes("\0");
const passwordMessage = "Passwords cannot contain null characters.";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "Enter a valid email address." })),
  password: z.string().min(1, "Enter your password.").refine((value) => Array.from(value).length <= 128, "Use at most 128 characters.").refine(passwordCharacters, passwordMessage),
});

export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Add your full name.").max(100),
  password: z.string().refine((value) => Array.from(value).length >= 8, "Use at least 8 characters.").refine((value) => Array.from(value).length <= 128, "Use at most 128 characters.").refine(passwordCharacters, passwordMessage),
});

export const emailSchema = signInSchema.pick({ email: true });
export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the complete 6-digit code.") });
export const resetPasswordSchema = signUpSchema.pick({ password: true }).extend({
  password_confirmation: z.string(),
}).refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords must match." });
export const changePasswordSchema = signUpSchema.pick({ password: true }).extend({
  current_password: signInSchema.shape.password,
  password_confirmation: z.string(),
}).refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords must match." });
export const invitationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Open the complete invitation link.") });
export const organizationRoleSchema = z.enum(["organization_admin", "recruiter", "hiring_manager"]);
export const inviteMemberSchema = emailSchema.extend({ role: organizationRoleSchema });
export const memberAccessSchema = z.object({ role: organizationRoleSchema, status: z.enum(["active", "inactive"]) });

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export type PhoneCountry = { iso: CountryCode; code: string; name: string };

export const PHONE_COUNTRIES: readonly PhoneCountry[] = getCountries().flatMap((iso) => {
  try {
    const name = regionNames.of(iso);
    return name ? [{ iso, code: `+${getCountryCallingCode(iso)}`, name }] : [];
  } catch {
    return [];
  }
}).sort((a, b) => a.name.localeCompare(b.name, "en") || a.iso.localeCompare(b.iso));

const phoneRegions = new Set<string>(PHONE_COUNTRIES.map((country) => country.iso));

export const EMPLOYER_INDUSTRIES = ["Information Technology", "Retail & eCommerce", "Manufacturing", "Healthcare", "Finance & Banking", "Education", "Hospitality", "Logistics", "Professional Services", "Other"] as const;

export const EMPLOYER_SIZES = ["1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "501–1,000 employees", "1,001–5,000 employees", "5,001+ employees"] as const;

export function validMobile(country: string, mobile: string) {
  return phoneRegions.has(country) && /^\d{4,15}$/.test(mobile) && isValidPhoneNumber(mobile, country as CountryCode);
}

export function phoneE164(country: string, mobile: string) {
  const parsed = parsePhoneNumberFromString(mobile, country as CountryCode);
  return parsed?.isValid() ? parsed.number : "";
}

export function callingCode(country: string) {
  return PHONE_COUNTRIES.find((item) => item.iso === country)?.code ?? "";
}

export const validPincode = (country: string, pincode: string) => (country === "IN" ? /^\d{6}$/ : /^[a-z0-9 -]{3,10}$/i).test(pincode);

export const employerMobileSchema = z.object({ country: z.string(), mobile: z.string().trim().min(1, "Enter your mobile number.") })
  .refine((v) => phoneRegions.has(v.country), { path: ["country"], message: "Choose a country code." })
  .refine((v) => !phoneRegions.has(v.country) || validMobile(v.country, v.mobile), { path: ["mobile"], message: "Enter a valid mobile number for the selected country, using digits only." });
export const employerDetailsSchema = z.object({
  accountType: z.enum(["company", "individual"]),
  fullName: signUpSchema.shape.name,
  email: signInSchema.shape.email,
  password: signUpSchema.shape.password,
});
export const employerCompanySchema = z.object({
  country: z.string(),
  hiringFor: z.enum(["company", "consultancy"]),
  companyName: z.string().trim().min(1, "Enter your company name.").max(150),
  industry: z.enum(EMPLOYER_INDUSTRIES),
  employees: z.enum(EMPLOYER_SIZES),
  designation: z.string().trim().min(1, "Enter your designation.").max(100),
  pincode: z.string().trim().max(10),
  address: z.string().trim().min(8, "Enter a company address of at least 8 characters.").max(500),
}).refine((v) => validPincode(v.country, v.pincode), { path: ["pincode"], message: "Enter a valid company postal code (6 digits for India)." });
