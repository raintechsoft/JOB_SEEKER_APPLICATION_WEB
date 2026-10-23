"use client";
import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import { useState } from "react";
import type { Id } from "@/types/domain";
import { today } from "@/lib/utils/date";
import { devCopy, isDevelopment } from "@/lib/env/app-env";
import { DevOnly } from "@/components/ui/dev-only";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { apiConfig } from "@/services/api/config";
import { useFormAction } from "@/hooks/use-form-action";
import { portfolioSharingSchema } from "@/lib/validation/portfolio";
import { validationFields } from "@/lib/validation/profile";
import { Button } from "@/components/ui/primitives";

const shareUrl = (slug: string) => window.location.origin + "/portfolio/" + slug;

/** Decorative 21×21 QR-like pattern. It is labelled as not scannable, as in the prototype. */
function QrRepresentation() {
  const cells = Array.from({ length: 441 }, (_, i) => {
    const x = i % 21;
    const y = Math.floor(i / 21);
    for (const [fx, fy] of [
      [0, 0],
      [14, 0],
      [0, 14],
    ]) {
      if (x >= fx && x < fx + 7 && y >= fy && y < fy + 7) {
        const xx = x - fx;
        const yy = y - fy;
        return xx === 0 || xx === 6 || yy === 0 || yy === 6 || (xx >= 2 && xx <= 4 && yy >= 2 && yy <= 4);
      }
    }
    return (i * 13 + x * y) % 5 < 2;
  });
  return (
    <div className="qr-representation" role="img" aria-label="Decorative QR code representation, not scannable">
      {cells.map((on, i) => (
        <i key={i} className={on ? "on" : ""} />
      ))}
    </div>
  );
}

function CopyFallback({ url }: { url: string }) {
  return (
    <>
      <TextField label="Copy this link" name="copy" defaultValue={url} readOnly onClick={(e) => e.currentTarget.select()} />
      <p className="small muted" style={{ marginTop: 15 }}>
        Select the link and copy it with your keyboard.
      </p>
    </>
  );
}

function ShareBody({ ownerId }: { ownerId: Id }) {
  const run = useServiceAction();
  const { data: view, isError, refetch } = useServiceQuery(["portfolio", ownerId], (s) => s.portfolio.getPortfolio(ownerId));
  if (!view) return <QueryFeedback data={view} error={isError} retry={refetch} layout="form" label="Loading sharing settings" />;
  const url = shareUrl(view.config.slug);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(devCopy("Portfolio link copied. Local edits stay in this browser.", "Portfolio link copied."));
    } catch {
      modal.show("Your portfolio link", <CopyFallback url={url} />);
    }
  };
  return (
    <>
      <p className="small muted">Share {view.person.name}’s saved portfolio view.</p>
      <div className="link-field" style={{ marginTop: 18, fontSize: 11 }}>
        <span className="grow">{url}</span>
        <IconButton icon="copy" label="Copy link" onClick={copy} />
      </div>
      <DevOnly>
        <QrRepresentation />
        <p className="small muted center" style={{ fontSize: 9 }}>
          QR representation · Not a scannable code
        </p>
      </DevOnly>
      <form
        id="sharing-form"
        className="stack"
        style={{ marginTop: 20 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const ok = await run((s) => s.portfolio.saveSharing(ownerId, { public: f.has("public"), otp: isDevelopment ? f.has("otp") : view.config.otp, expiry: isDevelopment ? String(f.get("expiry") || "") : view.config.expiry }));
          if (ok === undefined) return;
          toast(ok ? devCopy("Sharing preferences saved. Expiry and OTP remain simulations.", "Sharing preferences saved.") : "Saved for this page only. Browser storage is full or unavailable.");
          modal.close();
        }}
      >
        <label className="check-row">
          <input type="checkbox" name="public" defaultChecked={view.config.public} />
          {devCopy("Portfolio visible in this browser demo", "Portfolio visible to anyone with the link")}
        </label>
        <DevOnly>
          <TextField label="Link expiry (simulation)" name="expiry" type="date" defaultValue={view.config.expiry} min={today()} />
          <label className="check-row">
            <input type="checkbox" name="otp" defaultChecked={view.config.otp} />
            Demonstrate OTP protection setting
          </label>
          <div className="notice">Expiry and OTP settings are simulations and do not restrict access. A link opened on another device uses that browser’s sample data. Local edits are not uploaded or synchronized.</div>
        </DevOnly>
        <div className="modal-footer">
          <Link className="btn" href={"/portfolio/" + view.config.slug}>
            <Icon name="external" />
            Open portfolio
          </Link>
          <button type="submit" className="btn primary">
            Save sharing settings
          </button>
        </div>
      </form>
    </>
  );
}

function RealShareBody() {
  const query = useServiceQuery(["portfolio", "me"], (s) => s.portfolio.getPortfolio("me"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const action = useFormAction(setErrors);
  const view = query.data;
  if (!view) return <QueryFeedback data={view} error={query.isError} retry={query.refetch} layout="form" label="Loading sharing settings" />;
  const activeId = link?.id ?? view.shareLink?.id;
  return <form className="stack" noValidate onSubmit={async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = portfolioSharingSchema.safeParse({ public: form.has("public"), otp: false, expiry: String(form.get("expiry") ?? "") });
    if (!input.success) { setErrors(validationFields(input.error)); return; }
    setErrors({});
    await action.execute(async (s) => { if (!s.portfolio.createShare) throw new Error("Sharing is unavailable."); setLink(await s.portfolio.createShare(input.data, view.config.version!)); });
  }}>
    <p>Create a share link to your saved portfolio. Creating another link replaces the previous link.</p>
    <label className="check-row"><input name="public" type="checkbox" defaultChecked={view.config.public} disabled={action.pending} />Also publish my portfolio at its public address</label>
    <p className="small muted">A public portfolio remains available at its public address after a share link expires or is revoked.</p>
    <TextField name="expiry" label="Share link expiry (optional, UTC)" type="date" min={today()} defaultValue={view.config.expiry} error={errors.expiry} disabled={action.pending} />
    {errors._form && <p role="alert" className="error">{errors._form}</p>}
    {link && <div className="stack"><TextField name="link" label="Your share link" value={link.url} readOnly /><div className="row gap8"><Button onClick={async () => { try { await navigator.clipboard.writeText(link.url); toast("Share link copied."); } catch { modal.show("Your share link", <CopyFallback url={link.url} />); } }}>Copy link</Button><a className="btn" href={link.url} target="_blank" rel="noopener">Open link</a></div></div>}
    {activeId && <Button variant="danger" disabled={action.pending} onClick={async () => {
      if (await action.execute(async (s) => { if (!s.portfolio.revokeShare) throw new Error("Sharing is unavailable."); await s.portfolio.revokeShare(activeId, view.config.version!); })) { setLink(null); toast("Share link revoked."); }
    }}>Revoke share link</Button>}
    <div className="modal-footer"><Button onClick={() => modal.close()} disabled={action.pending}>Close</Button><Button type="submit" variant="primary" disabled={action.pending}>Create share link</Button></div>
  </form>;
}

export function useSharePortfolio() {
  const services = useServices();
  return async (ownerId: Id) => {
    if (await services.portfolio.getPortfolio(ownerId)) modal.show("A little more visibility.", apiConfig.dataSource === "http" ? <RealShareBody /> : <ShareBody ownerId={ownerId} />);
  };
}
