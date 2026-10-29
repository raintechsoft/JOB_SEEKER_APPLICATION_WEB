import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
import {ApplicationContactVerification} from "@/components/applications/application-contact-verification";
import {contactCountdown} from "@/lib/domain/application-contact";
import {createHttpApplicationDraftService} from "@/services/applications/application-wizard.http";
import {ApiError, createHttpClient} from "@/services/api/client";

const id = "10000000-0000-4000-8000-000000000001";
const input = {schemaVersion: 2 as const, kind: "email" as const, email: "alternate@example.test"};
const status = {id, kind: "email" as const, maskedDestination: "a•••@example.test", status: "pending" as const, sentAt: "2026-10-28T10:00:00Z", serverTime: "2026-10-28T10:00:00Z", expiresAt: "2026-10-28T10:05:00Z", resendAt: "2026-10-28T10:01:00Z"};
const proof = {email: {value: input.email, verified: true}, phone: null};
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks();});

it("validates contact and code shapes before invoking any HTTP or session request", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const post = vi.spyOn(http, "post"), get = vi.spyOn(http, "get");
  const service = createHttpApplicationDraftService(http);
  for (const value of [{...input, verified: true}, {...input, email: "bad"}, {schemaVersion: 2, kind: "phone", phone: {country: "IN", nationalNumber: "---------"}}, {schemaVersion: 2, kind: "phone", phone: {country: "ZZ", nationalNumber: "9876543210"}}]) await expect(service.challenge(id, value)).rejects.toThrow();
  for (const code of [123456, "12345", "12345a", "1234567", " 123456"]) await expect(service.verify(id, id, {schemaVersion: 2, code})).rejects.toThrow();
  await expect(service.verify("bad", id, {schemaVersion: 2, code: "123456"})).rejects.toThrow();
  await expect(service.contactStatus(id, "bad")).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

it("uses typed owned endpoints, normalization and preserves server rejection without mutation retries", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const post = vi.spyOn(http, "post").mockResolvedValueOnce({data: status}).mockResolvedValueOnce({data: proof}).mockRejectedValueOnce(new ApiError("expired", 422));
  const get = vi.spyOn(http, "get").mockResolvedValue({data: status});
  const service = createHttpApplicationDraftService(http);
  expect(await service.challenge(id, {...input, email: " ALTernate@example.test "})).toEqual(status);
  expect(post).toHaveBeenNthCalledWith(1, `me/application-drafts/${id}/contact-challenges`, input);
  expect(await service.verify(id, id, {schemaVersion: 2, code: "012345"})).toEqual(proof);
  expect(post).toHaveBeenNthCalledWith(2, `me/application-drafts/${id}/contact-challenges/${id}/verify`, {schemaVersion: 2, code: "012345"});
  expect(await service.contactStatus(id, id)).toEqual(status);
  expect(get).toHaveBeenCalledWith(`me/application-drafts/${id}/contact-challenges/${id}`);
  await expect(service.verify(id, id, {schemaVersion: 2, code: "012345"})).rejects.toMatchObject({status: 422});
  expect(post).toHaveBeenCalledTimes(3);
});

it("anchors expiry and resend to server time despite device wall-clock skew", () => {
  vi.setSystemTime(new Date("2039-01-01T00:00:00Z"));
  expect(contactCountdown(status, 100, 100)).toMatchObject({expires: 300, resend: 60, expired: false, canResend: false});
  expect(contactCountdown(status, 100, 60100)).toMatchObject({expires: 240, resend: 0, canResend: true});
  expect(contactCountdown(status, 100, 300100)).toMatchObject({expires: 0, expired: true});
  expect(contactCountdown({...status, serverTime: "2026-10-28T10:04:55Z"}, 100, 100)).toMatchObject({expires: 5, canResend: true});
});

it("reuses trusted proof without requesting or displaying a code", () => {
  const service = {challenge: vi.fn(), verify: vi.fn()};
  render(<ApplicationContactVerification draftId={id} input={input} verified service={service} onVerified={vi.fn()}/>);
  expect(screen.queryByText("Verified")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(service.challenge).not.toHaveBeenCalled();
});

it("blocks incomplete codes, exposes accessible errors and refetches proof only after server success", async () => {
  const service = {challenge: vi.fn().mockResolvedValue(status), verify: vi.fn().mockRejectedValueOnce(new ApiError("Invalid code", 422, {errors: {code: ["That code is incorrect."]}})).mockResolvedValueOnce(proof)};
  const verified = vi.fn();
  render(<ApplicationContactVerification draftId={id} input={input} verified={false} service={service} onVerified={verified}/>);
  fireEvent.click(screen.getByRole("button", {name: "Send verification code"}));
  await screen.findByText(/Code sent to/);
  expect(screen.getByText("Code expires in 5:00.")).toBeInTheDocument();
  expect(screen.getByRole("button", {name: "Resend in 60s"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name: "Verify code"}));
  await screen.findByRole("alert");
  expect(service.verify).not.toHaveBeenCalled();
  const code = screen.getByRole("textbox", {name: /Verification code/});
  expect(code).toHaveAttribute("aria-invalid", "true");
  expect(code).toHaveFocus();
  fireEvent.change(code, {target: {value: "123456"}});
  fireEvent.click(screen.getByRole("button", {name: "Verify code"}));
  await screen.findByText("That code is incorrect.");
  expect(verified).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Verify code"}));
  await waitFor(() => expect(verified).toHaveBeenCalledTimes(1));
});

it("expires the control automatically and never requests another code without a click", async () => {
  vi.useFakeTimers({toFake: ["setInterval", "clearInterval", "performance"]});
  const service = {challenge: vi.fn().mockResolvedValue({...status, expiresAt: "2026-10-28T10:00:01Z", resendAt: status.sentAt}), verify: vi.fn()};
  render(<ApplicationContactVerification draftId={id} input={input} verified={false} service={service} onVerified={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", {name: "Send verification code"}));
  await act(async () => {await Promise.resolve();});
  await act(async () => {vi.advanceTimersByTime(5000);});
  expect(screen.getByText("Code expired. Request a new code.")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(service.verify).not.toHaveBeenCalled();
  expect(service.challenge).toHaveBeenCalledTimes(1);
});

it("clears visible challenge state when the destination changes and honors server Retry-After", async () => {
  const service = {challenge: vi.fn().mockResolvedValueOnce(status).mockRejectedValueOnce(new ApiError("Wait before requesting another code.", 429, undefined, 17)), verify: vi.fn()};
  const props = {draftId: id, input, verified: false, service, onVerified: vi.fn()};
  const view = render(<ApplicationContactVerification {...props}/>);
  fireEvent.click(screen.getByRole("button", {name: "Send verification code"}));
  await screen.findByText(/Code sent/);
  view.rerender(<ApplicationContactVerification {...props} input={{...input, email: "changed@example.test"}}/>);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Send verification code"}));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", {name: "Try again in 17s"})).toBeDisabled();
  view.rerender(<ApplicationContactVerification {...props}/>);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByText(/Code sent/)).toBeNull();
});

it("ignores a late verification response after the selected contact changes", async () => {
  let resolve!: (value: typeof proof) => void;
  const service = {challenge: vi.fn().mockResolvedValue(status), verify: vi.fn().mockImplementation(() => new Promise<typeof proof>(done => {resolve = done;}))};
  const verified = vi.fn();
  const props = {draftId: id, input, verified: false, service, onVerified: verified};
  const view = render(<ApplicationContactVerification {...props}/>);
  fireEvent.click(screen.getByRole("button", {name: "Send verification code"}));
  await screen.findByText(/Code sent/);
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "123456"}});
  fireEvent.click(screen.getByRole("button", {name: "Verify code"}));
  view.rerender(<ApplicationContactVerification {...props} input={{...input, email: "changed@example.test"}}/>);
  await act(async () => {resolve(proof);});
  expect(verified).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
});
