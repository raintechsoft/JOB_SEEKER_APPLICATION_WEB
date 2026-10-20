import { z } from "zod";

export const signInSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }),
  password: z.string().min(8, "Use at least 8 characters."),
});

export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Add your full name."),
});

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;

export const PHONE_COUNTRIES = [
  { code: "+91", name: "India", min: 10, max: 10 },
  { code: "+1", name: "United States / Canada", min: 10, max: 10 },
  { code: "+44", name: "United Kingdom", min: 9, max: 10 },
  { code: "+971", name: "United Arab Emirates", min: 9, max: 9 },
  { code: "+65", name: "Singapore", min: 8, max: 8 },
  { code: "+61", name: "Australia", min: 9, max: 9 },
] as const;

export const EMPLOYER_INDUSTRIES = ["Information Technology", "Retail & eCommerce", "Manufacturing", "Healthcare", "Finance & Banking", "Education", "Hospitality", "Logistics", "Professional Services", "Other"];

export const EMPLOYER_SIZES = ["1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "501–1,000 employees", "1,001–5,000 employees", "5,001+ employees"];

export function validMobile(country: string, mobile: string) {
  const c = PHONE_COUNTRIES.find((x) => x.code === country);
  return !!c && new RegExp("^\\d{" + c.min + "," + c.max + "}$").test(mobile);
}

export const validPincode = (country: string, pincode: string) => (country === "+91" ? /^\d{6}$/ : /^[a-z0-9 -]{3,10}$/i).test(pincode);
