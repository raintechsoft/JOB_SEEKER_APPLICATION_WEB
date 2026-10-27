"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { modal, useModalStore } from "@/stores/modal-store";
import { Avatar, Button } from "@/components/ui/primitives";
import { MediaImage } from "@/components/ui/media-image";
import {
  ApiError,
  errorMessage as apiErrorMessage,
  fieldErrors,
} from "@/services/api/client";
import { ZodError } from "zod";
import {
  journeyEnabled,
  type CareerMemory,
  type JourneyChapter,
  type JourneyColleague,
  type JourneyPhoto,
  type JourneyView,
  type MemoryInput,
} from "@/services/journey/journey.service";
import {
  hasEmploymentDates,
  JOURNEY_RULES,
  validateMemory,
} from "@/lib/validation/journey";
import { today } from "@/lib/utils/date";
import "./journey.css";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase() || "W";
const errorMessage = (error: unknown) =>
  error instanceof ZodError
    ? (error.issues[0]?.message ?? "Check the memory details.")
    : error instanceof ApiError
      ? Object.values(fieldErrors(error)).flat().join(" ") ||
        apiErrorMessage(error)
      : error instanceof Error
        ? error.message
        : apiErrorMessage(error);
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
const monthLabel = (month: string) =>
  /^\d{4}-\d{2}$/.test(month)
    ? new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(month + "-01T00:00:00Z"))
    : "Dates not added";
const maxMemoryDate = (chapter?: JourneyChapter) => {
  if (!chapter || chapter.current || !/^\d{4}-\d{2}$/.test(chapter.end))
    return today();
  const last = new Date(
    Date.UTC(
      Number(chapter.end.slice(0, 4)),
      Number(chapter.end.slice(5, 7)),
      0,
    ),
  )
    .toISOString()
    .slice(0, 10);
  return last < today() ? last : today();
};
type Props = {
  slug?: string;
  onAddEmployment?: () => void;
  onEditEmployment?: (id: string) => void;
};

export function CareerJourney(props: Props) {
  return journeyEnabled ? <JourneyContent {...props} /> : null;
}

function JourneyContent({ slug, onAddEmployment, onEditEmployment }: Props) {
  const query = useServiceQuery(
    ["journey", slug ?? "owner"],
    (s) => s.journey.get(slug),
    { keepPreviousData: false },
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false),
    [error, setError] = useState("");
  const services = useServices();
  const view = query.data,
    owner = !slug;
  const openMemory = (chapter?: JourneyChapter, memory?: CareerMemory) =>
    view &&
    modal.show(
      memory ? "Edit memory" : "Capture a memory",
      <MemoryEditor view={view} chapter={chapter} memory={memory} />,
    );
  async function replay() {
    setReplayLoading(true);
    setError("");
    try {
      const memories: CareerMemory[] = [];
      let page: number | null = 1;
      while (page !== null) {
        const result = await services.journey.memories({ page }, slug);
        memories.push(...result.items);
        page = result.nextPage;
      }
      memories.sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      );
      if (!memories.length) {
        setError("Add a memory to start your journey replay.");
        return;
      }
      modal.show(
        "Your career, one moment at a time",
        <Replay memories={memories} chapters={view!.chapters} />,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setReplayLoading(false);
    }
  }
  if (query.isPending)
    return (
      <section
        id="profile-journey"
        className="card profile-section-card journey"
      >
        <h2>Career journey</h2>
        <p role="status">Loading your chapters…</p>
      </section>
    );
  if (query.isError)
    return (
      <section
        id="profile-journey"
        className="card profile-section-card journey"
      >
        <h2>Career journey</h2>
        <p role="alert">{errorMessage(query.error)}</p>
        <Button onClick={() => void query.refetch()}>Try again</Button>
      </section>
    );
  if (!view) return null;
  if (!owner && !view.chapters.length) return null;
  const active =
    expanded === "" || view.chapters.some((c) => c.id === expanded)
      ? expanded
      : view.chapters[0]?.id;
  const memoryCount = view.chapters.reduce(
    (n, c) => n + (c.memoryCount ?? 0),
    0,
  );
  const colleagueCount = view.chapters.reduce(
    (n, c) => n + (c.colleagues?.length ?? 0),
    0,
  );
  return (
    <section
      id="profile-journey"
      className="card profile-section-card journey"
      aria-labelledby="journey-title"
    >
      <div className="journey-intro">
        <div>
          <span className="journey-eyebrow">YOUR STORY, THROUGH THE YEARS</span>
          <h2 id="journey-title">
            Career journey
            <span className="journey-spark" aria-hidden="true">
              ✦
            </span>
          </h2>
          <p>The places, people, and moments that shaped your career.</p>
        </div>
        <div className="journey-actions">
          <Button onClick={() => void replay()} disabled={replayLoading}>
            {replayLoading ? "Preparing…" : "▷ Play journey"}
          </Button>
          {owner && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() =>
                view.chapters.length ? openMemory() : onAddEmployment?.()
              }
            >
              {view.chapters.length ? "Add memory" : "Add workplace"}
            </Button>
          )}
        </div>
      </div>
      {owner && (
        <div className="journey-stats">
          <span>
            <strong>{view.chapters.length}</strong>{" "}
            {view.chapters.length === 1 ? "workplace" : "workplaces"}
          </span>
          <span>
            <strong>{memoryCount}</strong>{" "}
            {memoryCount === 1 ? "memory" : "memories"}
          </span>
          <span>
            <strong>{colleagueCount}</strong>{" "}
            {colleagueCount === 1 ? "person" : "people"} along the way
          </span>
          <span className="journey-private">Private until you publish</span>
        </div>
      )}
      {error && (
        <p role="alert" className="journey-error">
          {error}
        </p>
      )}
      {!view.chapters.length ? (
        <div className="journey-empty">
          <span className="journey-empty-symbol" aria-hidden="true">
            ✧
          </span>
          <h3>Every career starts with a chapter.</h3>
          <p>
            Add your first workplace, then collect the moments and people that
            made it yours.
          </p>
          <Button onClick={onAddEmployment}>Add your first workplace</Button>
        </div>
      ) : (
        <div className="journey-timeline">
          {view.chapters.map((chapter, i) => (
            <article key={chapter.id} className="journey-chapter">
              <div className="journey-node" aria-hidden="true">
                {initials(chapter.company)}
              </div>
              <button
                type="button"
                className="journey-chapter-toggle"
                aria-expanded={active === chapter.id}
                aria-controls={`journey-chapter-${chapter.id}`}
                onClick={() =>
                  setExpanded(active === chapter.id ? "" : chapter.id)
                }
              >
                <div>
                  <div className="journey-company">
                    <h3>{chapter.company}</h3>
                    {chapter.current && (
                      <span className="journey-current">Current chapter</span>
                    )}
                  </div>
                  <p>{chapter.title}</p>
                  <span className="journey-dates">
                    {monthLabel(chapter.start)} —{" "}
                    {chapter.current ? "Present" : monthLabel(chapter.end)}
                  </span>
                </div>
                <span className="journey-chapter-index">
                  {String(i + 1).padStart(2, "0")}{" "}
                  <span aria-hidden="true">
                    {active === chapter.id ? "−" : "+"}
                  </span>
                </span>
              </button>
              {active === chapter.id && (
                <div id={`journey-chapter-${chapter.id}`}>
                  <Chapter
                    chapter={chapter}
                    view={view}
                    slug={slug}
                    onAdd={() => openMemory(chapter)}
                    onEdit={(m) => openMemory(chapter, m)}
                    onDates={() => onEditEmployment?.(chapter.id)}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="journey-footer">
        {owner
          ? "Your work history tells what you did. Your journey remembers how it felt."
          : "Selected moments shared by this professional."}
      </p>
    </section>
  );
}

function Chapter({
  chapter,
  view,
  slug,
  onAdd,
  onEdit,
  onDates,
}: {
  chapter: JourneyChapter;
  view: JourneyView;
  slug?: string;
  onAdd: () => void;
  onEdit: (m: CareerMemory) => void;
  onDates: () => void;
}) {
  const [year, setYear] = useState<number | undefined>();
  const owner = !slug;
  const query = useServiceQuery(
    ["journey-memories", slug ?? "owner", chapter.id, year],
    (s) => s.journey.memories({ employmentId: chapter.id, year }, slug),
    { keepPreviousData: false },
  );
  const items = query.data?.items ?? [];
  return (
    <div className="journey-branches">
      <div className="journey-year-rail" aria-label="Filter memories by year">
        <button
          type="button"
          aria-pressed={year === undefined}
          onClick={() => setYear(undefined)}
        >
          All years
        </button>
        {chapter.years.map((y) => (
          <button
            type="button"
            key={y}
            aria-pressed={year === y}
            onClick={() => setYear(y)}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="journey-branch">
        <div className="journey-branch-title">
          <h4>Moments that stayed</h4>
          {owner && (
            <button
              type="button"
              onClick={hasEmploymentDates(chapter) ? onAdd : onDates}
            >
              {hasEmploymentDates(chapter)
                ? "+ Add memory"
                : "Add employment dates"}
            </button>
          )}
        </div>
        {query.isPending ? (
          <p role="status">Loading memories…</p>
        ) : query.isError ? (
          <p role="alert">
            {errorMessage(query.error)}{" "}
            <button type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          </p>
        ) : items.length ? (
          <>
            <div className="journey-memory-grid">
              {items.slice(0, 3).map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  owner={owner}
                  onClick={() =>
                    modal.show(
                      m.title,
                      <MemoryDetail
                        memory={m}
                        chapter={chapter}
                        view={view}
                        owner={owner}
                        onEdit={() => onEdit(m)}
                      />,
                    )
                  }
                />
              ))}
            </div>
            {(items.length > 3 || query.data?.nextPage) && (
              <button
                type="button"
                className="journey-view-all"
                onClick={() =>
                  modal.show(
                    `${chapter.company} · Memories`,
                    <MemoryGallery
                      chapter={chapter}
                      view={view}
                      slug={slug}
                      year={year}
                      onEdit={onEdit}
                    />,
                  )
                }
              >
                View all memories →
              </button>
            )}
          </>
        ) : (
          <div className="journey-memory-empty">
            <p>
              {owner
                ? "The little moments belong here, too."
                : "No shared memories for this year."}
            </p>
            {owner && (
              <>
                <span>
                  Team celebrations, a proud launch, or something you learned.
                </span>
                <button
                  type="button"
                  onClick={hasEmploymentDates(chapter) ? onAdd : onDates}
                >
                  {hasEmploymentDates(chapter)
                    ? "Capture your first memory →"
                    : "Add employment dates →"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {owner && (
        <div className="journey-branch journey-people">
          <div className="journey-branch-title">
            <h4>
              People along the way{" "}
              <span className="journey-private-badge">Private</span>
            </h4>
            <button
              type="button"
              onClick={() =>
                modal.show(
                  "Add a colleague",
                  <ColleagueEditor chapter={chapter} view={view} />,
                )
              }
            >
              + Add colleague
            </button>
          </div>
          <div className="journey-person-list">
            {chapter.colleagues?.map((c) => (
              <button
                type="button"
                key={c.id}
                className="journey-person"
                onClick={() =>
                  modal.show(
                    "Edit colleague",
                    <ColleagueEditor
                      chapter={chapter}
                      view={view}
                      colleague={c}
                    />,
                  )
                }
              >
                <Avatar
                  person={{ id: c.personId, name: c.name, picture: c.picture }}
                />
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.role || "Colleague"}</small>
                </span>
              </button>
            ))}
          </div>
          {!chapter.colleagues?.length && (
            <p className="journey-muted">
              Remember the teammates, mentors, and friends who were part of this
              chapter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryCard({
  memory: m,
  owner,
  onClick,
}: {
  memory: CareerMemory;
  owner: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`journey-memory journey-memory-${m.type.toLowerCase()}`}
      onClick={onClick}
    >
      {m.photos[0] ? (
        <MediaImage
          src={m.photos[0].url}
          alt={m.photos[0].alt || "Memory photo"}
          loading="lazy"
        />
      ) : (
        <div className="journey-memory-art" aria-hidden="true">
          <span>
            {m.type === "Milestone" ? "✦" : m.type === "Reflection" ? "❝" : "◷"}
          </span>
          <small>{m.type}</small>
        </div>
      )}
      <div className="journey-memory-copy">
        <div className="journey-memory-meta">
          <span>{dateLabel(m.date)}</span>
          {owner && <span>{m.public ? "Public" : "Private"}</span>}
        </div>
        <h5>{m.title}</h5>
        {m.story && <p>{m.story}</p>}
        <span className="journey-memory-kind">
          {m.type}
          {m.photos.length > 1 ? ` · ${m.photos.length} photos` : ""}
        </span>
      </div>
    </button>
  );
}

function useJourneyRefresh() {
  const cache = useQueryClient();
  return async () => {
    await cache.invalidateQueries({
      predicate: (q) =>
        ["journey", "journey-memories", "profile", "candidate"].includes(
          String(q.queryKey[0]),
        ),
    });
  };
}

function MemoryDetail({
  memory: m,
  chapter,
  view,
  owner,
  onEdit,
}: {
  memory: CareerMemory;
  chapter: JourneyChapter;
  view: JourneyView;
  owner: boolean;
  onEdit: () => void;
}) {
  const services = useServices(),
    refresh = useJourneyRefresh();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function change(remove = false) {
    if (remove && !window.confirm("Delete this memory and its photos?")) return;
    setPending(true);
    setError("");
    useModalStore.setState({ blocking: true });
    try {
      if (remove)
        await services.journey.deleteMemory(m.id, view.profileVersion!);
      else {
        const input = validateMemory(
          { ...m, public: !m.public },
          view.chapters,
          !!view.profilePublic,
        );
        await services.journey.saveMemory(input, view.profileVersion!, m.id);
      }
      await refresh();
      modal.close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
      useModalStore.setState({ blocking: false });
    }
  }
  return (
    <div className="journey-detail">
      <p className="journey-eyebrow">
        {chapter.company} · {m.type}
      </p>
      <p className="journey-muted">
        {dateLabel(m.date)}
        {owner ? ` · ${m.public ? "Public" : "Private"}` : ""}
      </p>
      <div className="journey-photo-gallery">
        {m.photos.map((p) => (
          <figure key={p.id}>
            <MediaImage src={p.url} alt={p.alt || "Memory photo"} />
            {p.alt && <figcaption>{p.alt}</figcaption>}
          </figure>
        ))}
      </div>
      <p className="journey-story">{m.story}</p>
      {owner && !!m.colleagueIds?.length && (
        <div className="journey-detail-people">
          <strong>People in this memory · Private</strong>
          <p>
            {chapter.colleagues
              ?.filter((c) => m.colleagueIds?.includes(c.id))
              .map((c) => c.name)
              .join(", ")}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="journey-error">
          {error}
        </p>
      )}
      {owner && (
        <div className="journey-actions">
          <Button onClick={onEdit} disabled={pending}>
            Edit memory
          </Button>
          <Button onClick={() => void change()} disabled={pending}>
            {m.public ? "Make private" : "Publish to profile"}
          </Button>
          <Button onClick={() => void change(true)} disabled={pending}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

function MemoryGallery({
  chapter,
  view,
  slug,
  year,
  onEdit,
}: {
  chapter: JourneyChapter;
  view: JourneyView;
  slug?: string;
  year?: number;
  onEdit: (m: CareerMemory) => void;
}) {
  const services = useServices(),
    [additional, setAdditional] = useState<CareerMemory[]>([]),
    [nextPage, setPage] = useState<number | null | undefined>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const query = useServiceQuery(
    ["journey-memories", slug ?? "owner", chapter.id, year, "gallery"],
    (s) => s.journey.memories({ employmentId: chapter.id, year }, slug),
    { keepPreviousData: false },
  );
  const items = [...(query.data?.items ?? []), ...additional];
  const page = nextPage === undefined ? query.data?.nextPage : nextPage;
  async function load(next: number) {
    setPending(true);
    setError("");
    try {
      const result = await services.journey.memories(
        { employmentId: chapter.id, year, page: next },
        slug,
      );
      setAdditional((old) => [...old, ...result.items]);
      setPage(result.nextPage);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      {query.isPending && <p role="status">Loading memories…</p>}
      {query.isError && (
        <p role="alert">
          {errorMessage(query.error)}{" "}
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </p>
      )}
      <div className="journey-gallery-list">
        {items.map((m) => (
          <MemoryCard
            key={m.id}
            memory={m}
            owner={!slug}
            onClick={() =>
              modal.show(
                m.title,
                <MemoryDetail
                  memory={m}
                  chapter={chapter}
                  view={view}
                  owner={!slug}
                  onEdit={() => onEdit(m)}
                />,
              )
            }
          />
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {page != null && (
        <Button disabled={pending} onClick={() => void load(page)}>
          {pending ? "Loading…" : "Load more memories"}
        </Button>
      )}
    </div>
  );
}

function MemoryEditor({
  view,
  chapter,
  memory,
}: {
  view: JourneyView;
  chapter?: JourneyChapter;
  memory?: CareerMemory;
}) {
  const services = useServices(),
    refresh = useJourneyRefresh();
  const [step, setStep] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [input, setInput] = useState<MemoryInput>(
    memory
      ? { ...memory, colleagueIds: memory.colleagueIds ?? [] }
      : {
          employmentId: chapter?.id ?? view.chapters[0]?.id ?? "",
          title: "",
          story: "",
          date: "",
          type: "Moment",
          public: false,
          photos: [],
          colleagueIds: [],
        },
  );
  const newPhotos = useRef(new Set<string>()),
    saved = useRef(false),
    mounted = useRef(true);
  const selected = view.chapters.find((c) => c.id === input.employmentId);
  const publishable = !!view.profilePublic && !!selected?.public;
  useEffect(() => {
    mounted.current = true;
    const pendingPhotos = newPhotos.current;
    return () => {
      mounted.current = false;
      if (!saved.current)
        for (const id of pendingPhotos)
          void services.journey.discardPhoto(id).catch(() => undefined);
    };
  }, [services]);
  function patch(value: Partial<MemoryInput>) {
    setInput((old) => ({ ...old, ...value }));
    useModalStore.getState().setDirty(true);
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (files.length + input.photos.length > JOURNEY_RULES.photosMax) {
      setError("Choose up to four photos.");
      return;
    }
    setPending(true);
    setError("");
    useModalStore.setState({ blocking: true });
    const added: JourneyPhoto[] = [];
    try {
      for (const file of Array.from(files)) {
        const photo = await services.journey.upload(file);
        if (!mounted.current) {
          await services.journey.discardPhoto(photo.id).catch(() => undefined);
          return;
        }
        newPhotos.current.add(photo.id);
        added.push(photo);
      }
      if (mounted.current) patch({ photos: [...input.photos, ...added] });
    } catch (e) {
      for (const photo of added) {
        newPhotos.current.delete(photo.id);
        await services.journey.discardPhoto(photo.id).catch(() => undefined);
      }
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setPending(false);
      useModalStore.setState({ blocking: false });
    }
  }
  function next() {
    setError("");
    if (!selected || !hasEmploymentDates(selected)) {
      setError("Add employment dates in your profile before adding memories.");
      return;
    }
    if (step === 1) {
      try {
        validateMemory(
          { ...input, public: false },
          view.chapters,
          !!view.profilePublic,
        );
      } catch (e) {
        setError(errorMessage(e));
        return;
      }
    }
    setStep((s) => s + 1);
  }
  async function save(publish: boolean) {
    setError("");
    setPending(true);
    useModalStore.setState({ blocking: true });
    try {
      const value = validateMemory(
        { ...input, public: publish },
        view.chapters,
        !!view.profilePublic,
      );
      await services.journey.saveMemory(
        value,
        view.profileVersion!,
        memory?.id,
      );
      saved.current = true;
      await refresh();
      modal.close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
      useModalStore.setState({ blocking: false });
    }
  }
  return (
    <div className="journey-editor">
      <div
        className="journey-editor-steps"
        aria-label={`Step ${step + 1} of 3`}
      >
        {["The chapter", "The memory", "Review & share"].map((s, i) => (
          <span key={s} className={i <= step ? "active" : ""}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <fieldset disabled={pending}>
        {step === 0 ? (
          <>
            <label>
              Workplace
              <select
                value={input.employmentId}
                onChange={(e) =>
                  patch({
                    employmentId: e.target.value,
                    colleagueIds: [],
                    public: false,
                  })
                }
              >
                {view.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} · {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What kind of memory?
              <select
                value={input.type}
                onChange={(e) =>
                  patch({ type: e.target.value as MemoryInput["type"] })
                }
              >
                {JOURNEY_RULES.types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <p className="journey-muted">
              A team moment, a milestone you are proud of, or a reflection on
              what you learned.
            </p>
            {selected && !hasEmploymentDates(selected) && (
              <p role="alert">
                This workplace needs employment dates. Close this editor and add
                its start and end dates first.
              </p>
            )}
          </>
        ) : step === 1 ? (
          <>
            <label>
              Give this memory a title
              <input
                value={input.title}
                maxLength={120}
                onChange={(e) => patch({ title: e.target.value })}
                required
                placeholder="A little moment worth remembering"
              />
            </label>
            <label>
              When did it happen?
              <input
                type="date"
                value={input.date}
                min={selected?.start ? `${selected.start}-01` : "1800-01-01"}
                max={maxMemoryDate(selected)}
                onChange={(e) => patch({ date: e.target.value })}
                required
              />
            </label>
            <label>
              The story (optional)
              <textarea
                value={input.story}
                maxLength={2000}
                rows={4}
                onChange={(e) => patch({ story: e.target.value })}
                placeholder="What made this moment special?"
              />
            </label>
            <div className="journey-upload">
              <label>
                Add photos · up to four
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <small>JPEG, PNG, or WebP · up to 1 MB each</small>
            </div>
            <div className="journey-edit-photos">
              {input.photos.map((p, i) => (
                <div key={p.id}>
                  <MediaImage
                    src={p.url}
                    alt={p.alt || "Selected memory photo"}
                  />
                  <label>
                    Photo {i + 1} description
                    <input
                      value={p.alt}
                      maxLength={200}
                      onChange={(e) =>
                        patch({
                          photos: input.photos.map((photo) =>
                            photo.id === p.id
                              ? { ...photo, alt: e.target.value }
                              : photo,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      patch({
                        photos: input.photos.filter(
                          (photo) => photo.id !== p.id,
                        ),
                      });
                      if (newPhotos.current.delete(p.id))
                        void services.journey
                          .discardPhoto(p.id)
                          .catch(() => undefined);
                    }}
                  >
                    Remove photo
                  </button>
                </div>
              ))}
            </div>
            {!!selected?.colleagues?.length && (
              <div className="journey-colleague-picker">
                <strong>
                  Who was part of it?{" "}
                  <span className="journey-private-badge">Private</span>
                </strong>
                {selected.colleagues.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={input.colleagueIds?.includes(c.id) ?? false}
                      onChange={(e) =>
                        patch({
                          colleagueIds: e.target.checked
                            ? [...(input.colleagueIds ?? []), c.id]
                            : (input.colleagueIds ?? []).filter(
                                (id) => id !== c.id,
                              ),
                        })
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="journey-eyebrow">
              {selected?.company} · {input.type}
            </p>
            <h3>{input.title}</h3>
            <p>{input.date && dateLabel(input.date)}</p>
            <p className="journey-story">{input.story}</p>
            <div className="journey-photo-gallery">
              {input.photos.map((p) => (
                <MediaImage
                  key={p.id}
                  src={p.url}
                  alt={p.alt || "Memory photo"}
                />
              ))}
            </div>
            <div className="journey-review-note">
              <strong>
                You choose what becomes part of your public story.
              </strong>
              <p>
                Saving privately keeps this memory just for you. Colleague names
                and profile links always stay private.
              </p>
              {!publishable && (
                <p>
                  To publish, make your profile and this employment public
                  first.
                </p>
              )}
              {input.photos.some((p) => !p.alt.trim()) && (
                <p>Add a description to every photo before publishing.</p>
              )}
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="journey-error">
            {error}
          </p>
        )}
        <div className="journey-actions">
          {step > 0 && (
            <Button onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          {step < 2 ? (
            <Button variant="primary" onClick={next}>
              Continue
            </Button>
          ) : (
            <>
              <Button onClick={() => void save(false)}>
                {pending ? "Saving…" : "Save privately"}
              </Button>
              <Button
                variant="primary"
                disabled={
                  !publishable || input.photos.some((p) => !p.alt.trim())
                }
                onClick={() => void save(true)}
              >
                Publish to profile
              </Button>
            </>
          )}
        </div>
      </fieldset>
    </div>
  );
}

function ColleagueEditor({
  chapter,
  view,
  colleague,
}: {
  chapter: JourneyChapter;
  view: JourneyView;
  colleague?: JourneyColleague;
}) {
  const services = useServices(),
    refresh = useJourneyRefresh();
  const [personId, setPersonId] = useState(colleague?.personId ?? ""),
    [role, setRole] = useState(colleague?.role ?? ""),
    [search, setSearch] = useState("");
  const modalVersion = useModalStore((s) => s.version);
  const following = useServiceQuery(
    ["journey-following", chapter.id, modalVersion],
    (s) => s.journey.following(chapter.id),
    { keepPreviousData: false },
  );
  const candidates = (following.data ?? []).filter(
    (p) =>
      !chapter.colleagues?.some(
        (c) =>
          c.id !== colleague?.id &&
          (c.personId === p.id || (!!p.slug && c.profileSlug === p.slug)),
      ),
  );
  const selected = candidates.find((p) => p.id === personId);
  const visible = candidates.filter((p) =>
    `${p.name} ${p.headline ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function save(remove = false) {
    if (
      remove &&
      !window.confirm(
        "Remove this colleague and their private memory associations?",
      )
    )
      return;
    setPending(true);
    setError("");
    useModalStore.setState({ blocking: true });
    try {
      if (remove && colleague)
        await services.journey.deleteColleague(
          colleague.id,
          view.profileVersion!,
        );
      else {
        if (!selected)
          throw new Error("Choose someone you currently follow on Skillora.");
        await services.journey.saveColleague(
          { employmentId: chapter.id, personId: selected.id, role },
          view.profileVersion!,
          colleague?.id,
        );
      }
      await refresh();
      modal.close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
      useModalStore.setState({ blocking: false });
    }
  }
  return (
    <form
      className="journey-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="journey-muted">
        People you follow who worked at {chapter.company}. Their name and
        profile are filled automatically. This workplace connection stays
        private and sends no notification.
      </p>
      <fieldset disabled={pending}>
        <label>
          Search people you follow
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
            placeholder={`Search your connections at ${chapter.company}`}
          />
        </label>
        {following.isPending ? (
          <p role="status">Fetching people you follow…</p>
        ) : following.isError ? (
          <p role="alert">
            {errorMessage(following.error)}{" "}
            <Button onClick={() => void following.refetch()}>Try again</Button>
          </p>
        ) : (
          <div
            className="journey-following-list"
            role="group"
            aria-label="People you follow"
          >
            {visible.map((person) => (
              <label key={person.id} className="journey-following-option">
                <input
                  type="radio"
                  name="journey-person"
                  value={person.id}
                  checked={personId === person.id}
                  onChange={() => {
                    setPersonId(person.id);
                    useModalStore.getState().setDirty(true);
                  }}
                />
                <Avatar person={person} />
                <span>
                  <strong>{person.name}</strong>
                  <small>{person.headline || "Following on Skillora"}</small>
                </span>
              </label>
            ))}
            {!visible.length && (
              <p className="journey-muted">
                {search
                  ? "No matching people in your Following list."
                  : candidates.length
                    ? "No matching people."
                    : `No new matches at ${chapter.company}. Only followed people with this company in their public work history appear here.`}
              </p>
            )}
          </div>
        )}
        {colleague && !following.isPending && !selected && (
          <p className="journey-muted">
            To update this entry, select someone you currently follow. You can
            still remove the saved entry.
          </p>
        )}
        <label>
          Role or connection (optional)
          <input
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              useModalStore.getState().setDirty(true);
            }}
            maxLength={120}
            placeholder="Teammate, mentor, or friend"
          />
        </label>
        {(colleague?.profileHref || colleague?.profileSlug) && (
          <Link
            href={
              colleague.profileHref || `/professionals/${colleague.profileSlug}`
            }
            target="_blank"
            rel="noreferrer"
          >
            View linked profile ↗
          </Link>
        )}
        {error && (
          <p role="alert" className="journey-error">
            {error}
          </p>
        )}
        <div className="journey-actions">
          <Button
            type="submit"
            variant="primary"
            disabled={!selected || following.isPending || following.isError}
          >
            {pending ? "Saving…" : "Save colleague"}
          </Button>
          {colleague && (
            <Button onClick={() => void save(true)}>Remove colleague</Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function Replay({
  memories,
  chapters,
}: {
  memories: CareerMemory[];
  chapters: JourneyChapter[];
}) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(true);
  const memory = memories[index],
    chapter = chapters.find((c) => c.id === memory.employmentId);
  const years = [...new Set(memories.map((m) => m.date.slice(0, 4)))];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index === memories.length - 1) setPlaying(false);
      else setIndex((i) => i + 1);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [playing, index, memories.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        setIndex((i) => Math.min(memories.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [memories.length]);
  return (
    <div className="journey-replay">
      <div className="journey-replay-top">
        <span className="journey-eyebrow">{chapter?.company}</span>
        <label>
          Jump to year
          <select
            aria-label="Replay year"
            value={memory.date.slice(0, 4)}
            onChange={(e) => {
              setPlaying(false);
              setIndex(
                memories.findIndex((m) => m.date.startsWith(e.target.value)),
              );
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="journey-replay-image">
        {memory.photos[0] ? (
          <MediaImage
            src={memory.photos[0].url}
            alt={memory.photos[0].alt || "Memory photo"}
          />
        ) : (
          <span aria-hidden="true">
            {memory.type === "Milestone" ? "✦" : "❝"}
          </span>
        )}
      </div>
      <div aria-live={playing ? "off" : "polite"}>
        <p className="journey-muted">
          {dateLabel(memory.date)} · {memory.type}
        </p>
        <h3>{memory.title}</h3>
        <p className="journey-story">{memory.story}</p>
      </div>
      <div
        className="journey-replay-progress"
        aria-label={`Memory ${index + 1} of ${memories.length}`}
      >
        {memories.map((m, i) => (
          <span key={m.id} className={i <= index ? "active" : ""} />
        ))}
      </div>
      <div className="journey-actions">
        <Button
          disabled={index === 0}
          onClick={() => {
            setPlaying(false);
            setIndex((i) => i - 1);
          }}
        >
          ← Previous
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (index === memories.length - 1 && !playing) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          disabled={index === memories.length - 1}
          onClick={() => {
            setPlaying(false);
            setIndex((i) => i + 1);
          }}
        >
          Next →
        </Button>
        <span>
          {index + 1} / {memories.length}
        </span>
      </div>
    </div>
  );
}
