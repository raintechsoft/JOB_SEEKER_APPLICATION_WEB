import type { Job } from "@/types/domain";
import { moneyMinor } from "@/lib/validation/job-v2";

export type JobDiscoveryFilters = { employment?: string; education?: string; experience?: number; experienceMin?: number; experienceMax?: number; salaryMin?: number; salaryMax?: number; currency?: string; compensationPeriod?: string };
const whole = (value: unknown): number | null => value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
function numericPay(job: Job) {
  const c=job.compensation;
  if(c) {
    if (!("format" in c) || c.hidden || !["fixed","range","up_to"].includes(c.format))return null;
    return {currency:c.currency,period:c.period,lower:whole(c.minAmount),upper:whole(c.maxAmount??c.minAmount),upTo:c.format==="up_to"};
  }
  const v=job.wizardValues;
  if(!v||job.hideSalary||v.hideSalary||!v.currency)return null;
  const amount=(value:unknown)=>{if(value===""||value==null)return null;try{return Number(moneyMinor(String(value))*(v.currency==="INR"?100000n:1n))/100;}catch{return null;}};
  const lower=amount(v.salaryMin),upper=amount(v.salaryMax);
  return lower===null||upper===null?null:{currency:v.currency,period:"year",lower,upper,upTo:false};
}
export function jobPayReference(job: Job, filters: JobDiscoveryFilters): number | null {
  const pay=numericPay(job);
  if(!pay||pay.currency!==filters.currency||pay.period!==(filters.compensationPeriod??"year"))return null;
  return pay.lower??pay.upper;
}
export function matchesJobDiscovery(job: Job, filters: JobDiscoveryFilters): boolean {
  if(filters.employment&&filters.employment!==job.employment)return false;
  if(filters.education&&!job.wizardValues?.education?.includes(filters.education))return false;
  const lower=whole(job.wizardValues?.experienceMin),upper=whole(job.wizardValues?.experienceMax);
  const queryMin=filters.experience??filters.experienceMin,queryMax=filters.experience??filters.experienceMax;
  if(queryMin!==undefined&&(lower===null||upper!==null&&upper<queryMin))return false;
  if(queryMax!==undefined&&(lower===null||lower>queryMax))return false;
  if(filters.salaryMin!==undefined||filters.salaryMax!==undefined){
    const pay=numericPay(job);
    if(!pay||pay.currency!==filters.currency||pay.period!==(filters.compensationPeriod??"year"))return false;
    if(filters.salaryMin!==undefined&&(pay.upper===null||pay.upper<filters.salaryMin))return false;
    if(filters.salaryMax!==undefined&&!pay.upTo&&(pay.lower===null||pay.lower>filters.salaryMax))return false;
  }
  return true;
}
