"use client";

import { cloneElement, isValidElement, useCallback, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactElement, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils/text";
import { Spinner } from "./spinner";
import { Icon } from "@/components/ui/icon";

/**
 * Outlined floating-label controls.
 *
 * The prototype rewrote every labelled control with a MutationObserver
 * (`floating-fields.js`). These components render the resulting DOM directly:
 *   span.floating-field > control + span.floating-label (+ span.floating-required)
 * and keep the `has-value / is-required / is-disabled / is-readonly` classes in sync.
 */

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const DATE_TYPES = ["date", "month", "time", "datetime-local", "week"];

/** Native date/month/time fields should open the picker from a click anywhere on the control. */
export function openNativePicker(input: HTMLInputElement) {
  if (input.disabled || input.readOnly) return;
  try {
    input.showPicker?.();
  } catch {
    /* picker already open, or the browser blocked it */
  }
}

function isPickerType(type?: string) {
  return DATE_TYPES.includes(type ?? "");
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

function useFloatingSync(external?: Ref<Control>) {
  const control = useRef<Control | null>(null);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const sync = useCallback(() => {
    const el = control.current;
    const w = wrap.current;
    if (!el || !w) return;
    w.classList.toggle("has-value", String(el.value || "").length > 0);
    w.classList.toggle("is-disabled", el.disabled);
    w.classList.toggle("is-readonly", "readOnly" in el && el.readOnly === true);
    w.classList.toggle("is-required", el.required);
    const star = w.querySelector<HTMLElement>(".floating-required");
    if (star) star.hidden = !el.required;
  }, []);
  // Runs after every render so controlled values, disabled states and resets stay in sync.
  useLayoutEffect(sync);
  useLayoutEffect(() => {
    const el = control.current;
    if (!el) return;
    const events = ["input", "change", "focus", "blur"];
    events.forEach((e) => el.addEventListener(e, sync));
    const form = el.form;
    const onReset = () => requestAnimationFrame(sync);
    form?.addEventListener("reset", onReset);
    return () => {
      events.forEach((e) => el.removeEventListener(e, sync));
      form?.removeEventListener("reset", onReset);
    };
  }, [sync]);
  const controlRef = useCallback(
    (node: Control | null) => {
      control.current = node;
      setRef(external, node);
    },
    [external],
  );
  return { wrap, controlRef };
}

interface FloatingBase {
  label: string;
  compact?: boolean;
  /** Extra class on the floating wrapper. */
  wrapClassName?: string;
}

function FloatingLabel({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <span className="floating-label" id={id}>
      {label}
      <span className="floating-required" aria-hidden="true" hidden={!required}>
        *
      </span>
    </span>
  );
}

function a11y(label: string, props: { "aria-label"?: string; "aria-labelledby"?: string; placeholder?: string }, labelId: string) {
  const hint = props.placeholder && props.placeholder !== label ? props.placeholder : undefined;
  return {
    placeholder: " ",
    "aria-description": hint,
    "aria-labelledby": props["aria-label"] || props["aria-labelledby"] ? props["aria-labelledby"] : labelId,
  };
}

export type FloatingInputProps = Omit<ComponentProps<"input">, "ref"> & FloatingBase & { ref?: Ref<HTMLInputElement> };

export function FloatingInput({ label, compact, wrapClassName, ref, type, onClick, ...props }: FloatingInputProps) {
  const id = useId();
  const { wrap, controlRef } = useFloatingSync(ref as Ref<Control>);
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  const inputType = isPassword ? (revealed ? "text" : "password") : type;
  const picker = isPickerType(type);
  const openPicker = (input: EventTarget | null) => {
    if (picker && input instanceof HTMLInputElement) openNativePicker(input);
  };
  return (
    <span
      ref={wrap}
      className={cn("floating-field", picker && "is-date", isPassword && "has-password-toggle", compact && "is-compact", wrapClassName)}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const input = e.currentTarget.firstElementChild as HTMLElement | null;
        input?.focus();
        openPicker(input);
      }}
    >
      <input
        ref={controlRef}
        type={inputType}
        {...props}
        {...a11y(label, props, id)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) openPicker(event.currentTarget);
        }}
      />
      <FloatingLabel id={id} label={label} required={props.required} />
      {isPassword && (
        <button
          type="button"
          className="password-toggle"
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealed((v) => !v);
          }}
        >
          <Icon name={revealed ? "eyeOff" : "eye"} />
        </button>
      )}
    </span>
  );
}

export type FloatingTextAreaProps = Omit<ComponentProps<"textarea">, "ref"> & FloatingBase & { ref?: Ref<HTMLTextAreaElement> };

export function FloatingTextArea({ label, compact, wrapClassName, ref, ...props }: FloatingTextAreaProps) {
  const id = useId();
  const { wrap, controlRef } = useFloatingSync(ref as Ref<Control>);
  return (
    <span ref={wrap} className={cn("floating-field", "is-textarea", compact && "is-compact", wrapClassName)}>
      <textarea ref={controlRef} {...props} {...a11y(label, props, id)} />
      <FloatingLabel id={id} label={label} required={props.required} />
    </span>
  );
}

export type Option = string | { value: string; label: string };
const optionValue = (o: Option) => (typeof o === "string" ? o : o.value);
const optionLabel = (o: Option) => (typeof o === "string" ? o : o.label);

export type FloatingSelectProps = Omit<ComponentProps<"select">, "ref" | "children"> & FloatingBase & { options: readonly Option[]; ref?: Ref<HTMLSelectElement>; loading?: boolean };

export function FloatingSelect({ label, compact, wrapClassName, options, ref, loading = false, ...props }: FloatingSelectProps) {
  const id = useId();
  const { wrap, controlRef } = useFloatingSync(ref as Ref<Control>);
  const { placeholder: _placeholder, ...rest } = props as typeof props & { placeholder?: string };
  return (
    <span ref={wrap} className={cn("floating-field", "is-select", compact && "is-compact", wrapClassName)}>
      <select ref={controlRef} {...rest} disabled={props.disabled || loading} aria-busy={loading || undefined} aria-labelledby={props["aria-label"] || props["aria-labelledby"] ? props["aria-labelledby"] : id}>
        {options.map((o) => (
          <option key={optionValue(o)} value={optionValue(o)}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
      <FloatingLabel id={id} label={label} required={props.required} />
      {loading && <span className="select-loading" role="status" aria-label="Loading options"><Spinner /></span>}
    </span>
  );
}

/** `label.field` wrappers — the prototype's `field()`, `textarea()` and `select()` helpers. */
export function TextField({ hint, fieldStyle, error, ...props }: FloatingInputProps & { hint?: ReactNode; fieldStyle?: React.CSSProperties; error?: string }) {
  const errorId = useId();
  return (
    <label className="field" style={fieldStyle}>
      <FloatingInput {...props} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={error ? errorId : props["aria-describedby"]} />
      {error && <small id={errorId} role="alert" className="auth-field-error">{error}</small>}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TextAreaField({ fieldStyle, error, ...props }: FloatingTextAreaProps & { fieldStyle?: React.CSSProperties; error?: string }) {
  const errorId = useId();
  return (
    <label className="field" style={fieldStyle}>
      <FloatingTextArea {...props} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={error ? errorId : props["aria-describedby"]} />
      {error && <small id={errorId} role="alert" className="auth-field-error">{error}</small>}
    </label>
  );
}

export function SelectField({ error, ...props }: FloatingSelectProps & { error?: string }) {
  const errorId = useId();
  return (
    <label className="field">
      <FloatingSelect {...props} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={error ? errorId : props["aria-describedby"]} />
      {error && <small id={errorId} role="alert" className="auth-field-error">{error}</small>}
    </label>
  );
}

/** Checkboxes stay plain, as in the prototype (`label.check-row`). */
export function CheckRow({ children, className, style, ...props }: Omit<ComponentProps<"input">, "type"> & { children: ReactNode }) {
  return (
    <label className={cn("check-row", className)} style={style}>
      <input type="checkbox" {...props} />
      {children}
      {props.required && <span aria-hidden="true">*</span>}
    </label>
  );
}

/** On/off setting shown as a switch; still a native checkbox, so forms and keyboard work unchanged. */
export function ToggleRow({ children, hint, className, ...props }: Omit<ComponentProps<"input">, "type" | "role"> & { children: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("toggle-row", className)}>
      <span className="toggle-row-text">
        <span>{children}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" role="switch" {...props} />
      <span className="toggle-row-switch" aria-hidden="true" />
    </label>
  );
}

/** Static-label control: label stays beside the value, with no floating transition. */
export function SecondaryField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement;
}) {
  const id = useId();
  const errorId = useId();
  const native = typeof children.type === "string";
  const extra = native
    ? {
        id,
        className: cn("secondary-input", (children.props as { className?: string }).className),
        "aria-invalid": error ? true : (children.props as { "aria-invalid"?: boolean })["aria-invalid"],
        "aria-describedby": error ? errorId : (children.props as { "aria-describedby"?: string })["aria-describedby"],
      }
    : { id, error };
  return (
    <div className={cn("secondary-field", !native && "has-picker")}>
      <label htmlFor={id}>{label}</label>
      <div className="secondary-field-value">
        {isValidElement(children) ? cloneElement(children, extra as never) : children}
        {error && native && (
          <small id={errorId} role="alert" className="auth-field-error">
            {error}
          </small>
        )}
      </div>
    </div>
  );
}

/** Plain file input inside `label.field` (file inputs are excluded from floating labels). */
export function FileField({ label, hint, ...props }: Omit<ComponentProps<"input">, "type"> & { label: string; hint?: ReactNode }) {
  return (
    <label className="field">
      <span>{label}{props.required && <span aria-hidden="true">*</span>}</span>
      <input type="file" {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
