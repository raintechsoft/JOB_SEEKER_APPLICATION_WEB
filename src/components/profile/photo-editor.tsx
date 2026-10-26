"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";
import { Avatar, Button, avatarSource, type AvatarPerson } from "@/components/ui/primitives";
import { FormError } from "@/components/ui/feedback";
import { mediaRules, validateMedia } from "@/lib/validation/profile";
import { exportProfilePhoto, INITIAL_PHOTO_TRANSFORM, loadProfilePhoto, PHOTO_FRAMES, photoGeometry, type PhotoTransform } from "@/lib/utils/profile-photo";
import { ApiError, errorMessage } from "@/services/api/client";
import { modal, useModalStore } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";

export type PhotoEditorPurpose = "portrait" | "recruiter_photo" | "logo" | "cover";
interface PhotoEditorProps {
  person?: AvatarPerson;
  imageUrl?: string;
  purpose?: PhotoEditorPurpose;
  sources?: "all" | "computer";
  onSave: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  savedMessage?: string;
  removedMessage?: string;
}
type View = "preview" | "edit" | "update" | "camera" | "remove";
type CropShape = "circle" | "square" | "landscape";
const copy: Record<PhotoEditorPurpose, {
  titles: Record<View, string>;
  emptyHint: string;
  updateHint: string;
  typeHint: string;
  removeHint: string;
  saveLabel: string;
  changeLabel: string;
  removeLabel: string;
  fileLabel: string;
  cropLabel: string;
  filename: string;
  shape: CropShape;
  emptyIcon: IconName;
}> = {
  portrait: { titles: { preview: "Profile photo", edit: "Edit photo", update: "Update profile photo", camera: "Take a photo", remove: "Remove profile photo?" }, emptyHint: "Add a photo to help people recognize you.", updateHint: "Choose how you’d like to add your photo.", typeHint: "You can adjust it before saving.", removeHint: "Your initials will appear until you add another photo.", saveLabel: "Save photo", changeLabel: "Change photo", removeLabel: "Remove photo", fileLabel: "Choose a profile photo", cropLabel: "Cropped profile photo preview", filename: "profile-photo.jpg", shape: "circle", emptyIcon: "user" },
  recruiter_photo: { titles: { preview: "Profile photo", edit: "Edit photo", update: "Update profile photo", camera: "Take a photo", remove: "Remove profile photo?" }, emptyHint: "Add a photo to help people recognize you.", updateHint: "Choose how you’d like to add your photo.", typeHint: "You can adjust it before saving.", removeHint: "Your initials will appear until you add another photo.", saveLabel: "Save photo", changeLabel: "Change photo", removeLabel: "Remove photo", fileLabel: "Choose a profile photo", cropLabel: "Cropped profile photo preview", filename: "profile-photo.jpg", shape: "circle", emptyIcon: "user" },
  logo: { titles: { preview: "Organization logo", edit: "Edit logo", update: "Update organization logo", camera: "Take a photo", remove: "Remove organization logo?" }, emptyHint: "Add a square logo for your organization.", updateHint: "Upload a logo from your computer.", typeHint: "Square image recommended. You can adjust it before saving.", removeHint: "A building icon will appear until you add another logo.", saveLabel: "Save logo", changeLabel: "Change logo", removeLabel: "Remove logo", fileLabel: "Choose an organization logo", cropLabel: "Cropped organization logo preview", filename: "organization-logo.jpg", shape: "square", emptyIcon: "building" },
  cover: { titles: { preview: "Cover image", edit: "Edit cover image", update: "Update cover image", camera: "Take a photo", remove: "Remove cover image?" }, emptyHint: "Add a landscape cover image for your organization.", updateHint: "Upload a cover image from your computer.", typeHint: "Landscape image recommended. You can adjust it before saving.", removeHint: "The default banner will appear until you add another cover image.", saveLabel: "Save cover", changeLabel: "Change cover", removeLabel: "Remove cover", fileLabel: "Choose a cover image", cropLabel: "Cropped cover image preview", filename: "organization-cover.jpg", shape: "landscape", emptyIcon: "image" },
};
const photoError = (error: unknown) => error instanceof ApiError ? errorMessage(error) : error instanceof Error ? error.message : errorMessage(error);

/** One native dialog with successive views; dismissing drops only local photo adjustments. */
export function PhotoEditor(props: PhotoEditorProps) {
  const { person, imageUrl = "", purpose = "portrait", sources = "all", onSave, onRemove, savedMessage = "Profile photo updated.", removedMessage = "Profile photo removed." } = props;
  const labels = copy[purpose];
  const frame = PHOTO_FRAMES[purpose];
  const current = person ? avatarSource(person) : imageUrl;
  const [view, setView] = useState<View>("preview");
  const [returnTo, setReturnTo] = useState<"preview" | "edit">("preview");
  const [source, setSource] = useState<{ image: HTMLImageElement; src: string } | null>(null);
  const [transform, setTransform] = useState<PhotoTransform>(INITIAL_PHOTO_TRANSFORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false), mounted = useRef(true), objectUrl = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; offsetX: number; offsetY: number; ratio: number } | null>(null);
  const rule = mediaRules[purpose];
  const geometry = source ? photoGeometry(source.image.naturalWidth, source.image.naturalHeight, transform, frame) : null;
  const computerOnly = sources === "computer";
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, []);
  useEffect(() => {
    useModalStore.setState({ title: labels.titles[view] });
    heading.current?.focus();
  }, [view, labels]);
  const changeView = (next: View) => { setError(""); setView(next); };
  const run = async (work: () => Promise<void>, blockClose = false) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    if (blockClose) useModalStore.setState({ blocking: true });
    try { await work(); }
    catch (e) { if (mounted.current) setError(photoError(e)); }
    finally { locked.current = false; if (mounted.current) { setBusy(false); if (blockClose) useModalStore.setState({ blocking: false }); } }
  };
  const prepare = async (file: File) => {
    const invalid = validateMedia(file, purpose);
    if (invalid) { setError(invalid); return; }
    await run(async () => {
      const url = URL.createObjectURL(file);
      try {
        const image = await loadProfilePhoto(url);
        if (!mounted.current) { URL.revokeObjectURL(url); return; }
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = url;
        setSource({ image, src: url }); setTransform(INITIAL_PHOTO_TRANSFORM);
        useModalStore.getState().setDirty(true); changeView("edit");
      } catch { URL.revokeObjectURL(url); throw new Error("This image could not be opened. Choose a valid PNG, JPEG or WebP photo."); }
    });
  };
  const edit = () => run(async () => {
    if (!current) return;
    const image = await loadProfilePhoto(current);
    if (!mounted.current) return;
    setSource({ image, src: current }); setTransform(INITIAL_PHOTO_TRANSFORM); changeView("edit");
  });
  const adjust = (next: PhotoTransform) => {
    if (busy || !source) return;
    const constrained = photoGeometry(source.image.naturalWidth, source.image.naturalHeight, next, frame);
    setTransform({ ...next, x: constrained.x, y: constrained.y }); useModalStore.getState().setDirty(true);
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || !geometry || !event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: geometry.x, offsetY: geometry.y, ratio: frame.width / event.currentTarget.getBoundingClientRect().width };
  };
  const update = () => { setReturnTo(view === "edit" ? "edit" : "preview"); changeView("update"); };
  return <section className={"photo-editor" + (labels.shape !== "circle" ? " is-" + labels.shape : "")} aria-busy={busy || undefined}>
    <h3 className="sr-only" ref={heading} tabIndex={-1}>{labels.titles[view]}</h3>
    <input ref={input} className="sr-only" tabIndex={-1} type="file" aria-label={labels.fileLabel} accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
      if (file) void prepare(file);
    }} />
    {view === "preview" && <>
      <div className={"photo-editor-portrait is-" + labels.shape}>
        {person ? <Avatar person={person} size="xl" /> : current ? <MediaImage src={current} alt="" className="photo-editor-preview-image" /> : <span className="photo-editor-empty"><Icon name={labels.emptyIcon} /></span>}
      </div>
      {!current && <p className="photo-editor-hint">{labels.emptyHint}</p>}
      <div className="photo-editor-actions">
        <Button icon="edit" disabled={!current || busy} onClick={edit}>Edit</Button>
        <Button icon={computerOnly ? "upload" : "camera"} disabled={busy} onClick={update}>Update</Button>
        {current && <Button variant="text" icon="trash" disabled={busy} onClick={() => changeView("remove")}>{labels.removeLabel}</Button>}
      </div>
    </>}
    {view === "update" && <>
      <p className="photo-editor-hint">{computerOnly ? labels.updateHint : copy.portrait.updateHint}</p>
      <div className={"photo-source-options" + (computerOnly ? " is-single" : "")}>
        {!computerOnly && <Button className="photo-source-option" icon="camera" onClick={() => changeView("camera")} disabled={busy}>Use camera</Button>}
        <Button className="photo-source-option" icon="upload" onClick={() => input.current?.click()} disabled={busy}>Upload from computer</Button>
      </div>
      <p className="photo-editor-hint">PNG, JPEG or WebP, up to {rule.max / 1024} KB. {labels.typeHint}</p>
      <div className="modal-footer"><Button onClick={() => changeView(returnTo)} disabled={busy}>{returnTo === "edit" ? "Back to editing" : "Back to photo"}</Button></div>
    </>}
    {view === "camera" && !computerOnly && <CameraCapture maxBytes={rule.max} onCapture={prepare} onBack={() => changeView("update")} onUpload={() => { changeView("update"); input.current?.click(); }} />}
    {view === "edit" && source && geometry && <>
      <div className="photo-crop-stage">
        <div className={"photo-crop-circle is-" + labels.shape} role="group" aria-label="Photo crop area" aria-describedby="photo-crop-help" tabIndex={0} onPointerDown={pointerDown} onPointerMove={event => {
          const start = drag.current;
          if (start && start.id === event.pointerId) adjust({ ...transform, x: start.offsetX + (event.clientX - start.x) * start.ratio, y: start.offsetY + (event.clientY - start.y) * start.ratio });
        }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => {
          const step = event.shiftKey ? 20 : 5;
          const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (!delta[event.key]) return;
          event.preventDefault(); adjust({ ...transform, x: geometry.x + delta[event.key][0], y: geometry.y + delta[event.key][1] });
        }}>
          <svg viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={labels.cropLabel}>
            <g transform={`translate(${frame.width / 2 + geometry.x} ${frame.height / 2 + geometry.y}) scale(${transform.flipX ? -1 : 1} 1) rotate(${transform.rotation}) scale(${geometry.scale})`}>
              <image href={source.src} crossOrigin={/^https?:/i.test(source.src) ? "use-credentials" : undefined} x={-source.image.naturalWidth / 2} y={-source.image.naturalHeight / 2} width={source.image.naturalWidth} height={source.image.naturalHeight} />
            </g>
          </svg>
        </div>
      </div>
      <p id="photo-crop-help" className="photo-editor-hint">Drag to reposition, or focus the photo and use the arrow keys.</p>
      <label className="photo-zoom-control">Zoom <input type="range" min="1" max="3" step="0.05" value={transform.zoom} disabled={busy} onChange={event => adjust({ ...transform, zoom: Number(event.target.value) })} /><output>{Math.round(transform.zoom * 100)}%</output></label>
      <div className="photo-editor-tools">
        <Button icon="rotate" disabled={busy} onClick={() => adjust({ ...transform, rotation: (transform.rotation + (transform.flipX ? 270 : 90)) % 360, x: 0, y: 0 })}>Rotate</Button>
        <Button icon="flip" disabled={busy} title="Flip horizontally" aria-pressed={transform.flipX} onClick={() => adjust({ ...transform, flipX: !transform.flipX, x: -transform.x })}>Flip</Button>
        <Button icon="refresh" disabled={busy} onClick={() => adjust(INITIAL_PHOTO_TRANSFORM)}>Reset</Button>
        <Button variant="text" onClick={update} disabled={busy}>{labels.changeLabel}</Button>
      </div>
      <div className="modal-footer">
        <Button disabled={busy} onClick={() => modal.requestClose()}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={busy} onClick={() => run(async () => {
          const file = await exportProfilePhoto(source.image, transform, rule.max, frame, labels.filename);
          const invalid = validateMedia(file, purpose); if (invalid) throw new Error(invalid);
          await onSave(file); useModalStore.getState().setDirty(false); modal.close(); toast(savedMessage);
        }, true)}>{labels.saveLabel}</Button>
      </div>
    </>}
    {view === "remove" && <>
      <p className="photo-editor-hint">{labels.removeHint}</p>
      <div className="modal-footer"><Button disabled={busy} onClick={() => changeView("preview")}>Cancel</Button><Button variant="danger" loading={busy} disabled={busy} onClick={() => run(async () => { await onRemove(); modal.close(); toast(removedMessage); }, true)}>{labels.removeLabel}</Button></div>
    </>}
    <div role={error ? "alert" : undefined}><FormError message={error} /></div>
  </section>;
}

function CameraCapture({ maxBytes, onCapture, onBack, onUpload }: { maxBytes: number; onCapture: (file: File) => Promise<void>; onBack: () => void; onUpload: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [capturing, setCapturing] = useState(false);
  const captureLock = useRef(false);
  useEffect(() => {
    let cancelled = false, stream: MediaStream | undefined;
    const stop = () => { stream?.getTracks().forEach(track => track.stop()); };
    const visibility = () => { if (document.hidden) { stop(); setReady(false); setError("Camera paused. Go back and open it again, or upload a photo."); } };
    document.addEventListener("visibilitychange", visibility);
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (cancelled || document.hidden) { stop(); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
      } catch (e) {
        stop();
        if (!cancelled) setError(e instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(e.name) ? "Camera access was denied. Allow it in your browser settings, or upload a photo instead." : "Your camera could not be opened. Check that it is connected and available, or upload a photo instead.");
      }
    })();
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return <div className="photo-camera">
    <video ref={video} autoPlay playsInline muted aria-label="Camera preview" onLoadedData={() => setReady(true)} />
    <p className="photo-editor-hint">Your camera preview stays on this device. A photo is uploaded only after you capture, adjust and save it.</p>
    <div role={error ? "alert" : undefined}><FormError message={error} /></div>
    <div className="modal-footer">
      <Button onClick={onBack} disabled={capturing}>Back</Button>
      <Button onClick={onUpload} disabled={capturing}>Upload instead</Button>
      <Button variant="primary" icon="camera" disabled={!ready || !!error || capturing} loading={capturing} onClick={async () => {
        const element = video.current;
        if (!element?.videoWidth || !element?.videoHeight || captureLock.current) return;
        captureLock.current = true; setCapturing(true);
        try {
          const canvas = document.createElement("canvas"), scale = Math.min(1, 1280 / Math.max(element.videoWidth, element.videoHeight));
          canvas.width = Math.round(element.videoWidth * scale); canvas.height = Math.round(element.videoHeight * scale);
          const context = canvas.getContext("2d"); if (!context) throw new Error("The camera photo could not be captured.");
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
          if (!blob || blob.size > maxBytes) throw new Error("The camera photo is too large. Try uploading a smaller image instead.");
          await onCapture(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
        } catch (e) { setError(photoError(e)); }
        finally { captureLock.current = false; setCapturing(false); }
      }}>Take photo</Button>
    </div>
  </div>;
}
