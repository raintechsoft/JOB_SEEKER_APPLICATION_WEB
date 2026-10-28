"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { TextField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { InfoBadge } from "@/components/ui/info-badge";
import { searchSettings, type SearchOptions } from "@/lib/search/scopes";
import { compensationQuerySchema, compensationQueryErrors } from "@/lib/validation/job-discovery";
import { validationFields } from "@/lib/validation/profile";
import { filterPopoverPosition } from "@/lib/search/popover-position";

const contextKeys = ["currency", "compensationPeriod", "salaryMin", "salaryMax"] as const;
export function withoutCompensation(options: SearchOptions): SearchOptions {
  const next = { ...options };
  for (const key of contextKeys) delete next[key];
  if (next.sort === "salary_asc" || next.sort === "salary_desc") delete next.sort;
  return next;
}

export function CompensationFilter({ options, disabled, onApply }: { options: SearchOptions; disabled?: boolean; onApply: (next: SearchOptions) => boolean }) {
  const [open, setOpen] = useState(false), [errors, setErrors] = useState<Record<string,string>>({});
  const root = useRef<HTMLDivElement>(null), first = useRef<HTMLSelectElement>(null), id = useId();
  const trigger=useRef<HTMLButtonElement>(null), menu=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<ReturnType<typeof filterPopoverPosition>|null>(null);
  const active = contextKeys.some(key => options[key] !== undefined);
  useLayoutEffect(()=>{
    if(!open)return;
    const update=()=>{
      if(!trigger.current||!menu.current)return;
      const viewport=window.visualViewport;
      const next=filterPopoverPosition(trigger.current.getBoundingClientRect(),menu.current.getBoundingClientRect().height,{width:viewport?.width??window.innerWidth,height:viewport?.height??window.innerHeight,left:viewport?.offsetLeft??0,top:viewport?.offsetTop??0});
      setPosition(previous=>previous&&previous.left===next.left&&previous.top===next.top&&previous.width===next.width&&previous.maxHeight===next.maxHeight?previous:next);
    };
    update();window.addEventListener("resize",update);window.addEventListener("scroll",update,true);
    window.visualViewport?.addEventListener("resize",update);window.visualViewport?.addEventListener("scroll",update);
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;if(menu.current)observer?.observe(menu.current);
    return()=>{window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true);window.visualViewport?.removeEventListener("resize",update);window.visualViewport?.removeEventListener("scroll",update);observer?.disconnect();};
  },[open]);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown",outside); document.addEventListener("keydown",escape);
    return () => { document.removeEventListener("pointerdown",outside); document.removeEventListener("keydown",escape); };
  },[open]);
  return <div className="ui-dropdown" ref={root}>
    <button ref={trigger} type="button" className="search-filter-control" disabled={disabled} aria-label="Compensation filter" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} data-active={active} onClick={()=>{setErrors({});setOpen(value=>!value);}}><span>Compensation{active?": selected":""}</span><Icon name="chevron"/></button>
    {open&&<div ref={menu} className="ui-dropdown-menu" role="dialog" aria-label="Compensation filters" id={id} style={{position:"fixed",left:position?.left??16,top:position?.top??16,right:"auto",bottom:"auto",width:position?.width??"min(340px, calc(100vw - 32px))",minWidth:0,maxWidth:"calc(100vw - 32px)",maxHeight:position?.maxHeight??"calc(100dvh - 32px)",overflowY:"auto",padding:16}}>
      <div className="row between"><strong>Compensation</strong><InfoBadge label="How compensation sorting works">Sorting compares a fixed amount, the lower end of a range or an up-to ceiling. An up-to ceiling is not a guaranteed starting amount. Roles without a comparable disclosed amount appear last.</InfoBadge></div>
      <form className="stack" noValidate onSubmit={event=>{
        event.preventDefault(); const form=event.currentTarget, data=new FormData(form), input:Record<string,unknown>={};
        for(const key of ["currency","compensationPeriod"]){const value=String(data.get(key)??"");if(value)input[key]=value;}
        for(const key of ["salaryMin","salaryMax"]){const value=String(data.get(key)??"").trim(), control=form.elements.namedItem(key);if(control instanceof HTMLInputElement&&control.validity.badInput)input[key]=NaN;else if(value)input[key]=Number(value);}
        const checked=compensationQuerySchema.safeParse(input);
        if(!checked.success){setErrors(validationFields(checked.error));return;}
        const next={...withoutCompensation(options),...checked.data,...(options.sort?{sort:options.sort}:{})};
        const extra=compensationQueryErrors(next);
        if((next.salaryMin!==undefined||next.salaryMax!==undefined)&&!next.compensationPeriod)extra.compensationPeriod="Choose the payment period for these amounts.";
        if(Object.keys(extra).length){setErrors(extra);return;}
        if(onApply(next)!==false)setOpen(false);
      }}>
        <SelectField label="Currency" name="currency" defaultValue={options.currency??""} options={[{value:"",label:"Any currency"},...searchSettings.currencies]} error={errors.currency} ref={first}/>
        <SelectField label="Payment period" name="compensationPeriod" defaultValue={options.compensationPeriod??""} options={[{value:"",label:"Any period"},...searchSettings.compensationPeriods.map(value=>({value,label:`Per ${value}`}))]} error={errors.compensationPeriod}/>
        <TextField label="Minimum pay" name="salaryMin" type="number" min={0} max={1e12} step="0.01" defaultValue={options.salaryMin??""} error={errors.salaryMin}/>
        <TextField label="Maximum pay" name="salaryMax" type="number" min={0} max={1e12} step="0.01" defaultValue={options.salaryMax??""} error={errors.salaryMax}/>
        <p className="small muted">Use full currency amounts for the selected period. Hidden, unspecified and schedule-based pay is excluded from numeric comparisons.</p>
        {!!Object.keys(errors).length&&<p role="alert">Correct the highlighted compensation filters.</p>}
        <div className="row between"><Button type="button" variant="text sm" onClick={()=>{if(onApply(withoutCompensation(options))!==false)setOpen(false);}}>Clear</Button><Button type="submit" variant="primary sm">Apply compensation</Button></div>
      </form>
    </div>}
  </div>;
}
