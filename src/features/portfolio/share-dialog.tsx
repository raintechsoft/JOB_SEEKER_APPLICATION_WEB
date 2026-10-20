"use client";

import Link from "next/link";
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
  const { data: view } = useServiceQuery(["portfolio", ownerId], (s) => s.portfolio.getPortfolio(ownerId));
  if (!view) return null;
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

export function useSharePortfolio() {
  const services = useServices();
  return async (ownerId: Id) => {
    if (await services.portfolio.getPortfolio(ownerId)) modal.show("A little more visibility.", <ShareBody ownerId={ownerId} />);
  };
}
