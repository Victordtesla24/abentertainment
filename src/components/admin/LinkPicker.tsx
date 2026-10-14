'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { parseRole, ROLE_MAX_LENGTH, ROLE_SUGGESTIONS } from '@/lib/event-sponsors';

/**
 * Multi-select with a role per choice, shared by the two sides of the same link: the Events form picks sponsors and
 * partners, the Sponsors form picks events. The chosen entries are listed first, each with its logo or initials, its
 * name and a free-text role (with the three usual ones suggested); below them a searchable combobox adds more. Everything
 * can be done from the keyboard, the controls are at least 44 px tall on a phone, and nothing here talks to the server:
 * the form owns the list and sends it.
 */

export interface LinkOption {
  id: string;
  /** The company name, or the event title. */
  title: string;
  /** A second line under the title (the event's date and status, a sponsor's category). */
  detail?: string;
  /** A logo to show; without one the initials are shown. */
  image?: string;
  /** A note that applies to this entry (for example that a sponsor is hidden on the website). */
  note?: string;
  /** The role a new choice of this entry starts with. */
  defaultRole: string;
}

export interface LinkChoice {
  id: string;
  role: string;
}

export interface LinkNoun {
  singular: string;
  plural: string;
}

/** The problem with one role as typed, in words for the form; undefined when it is fine. */
export function roleProblem(role: string): string | undefined {
  const parsed = parseRole(role);
  return parsed.error ? `Role ${parsed.error}` : undefined;
}

/**
 * Everything wrong with a list of choices, in words for the form (all of it, in list order): a role that is too long or
 * has control characters, an entry that no longer exists, and a list that is longer than the server accepts. An empty
 * result means the list can be sent.
 */
export function choiceProblems(choices: readonly LinkChoice[], options: readonly LinkOption[], noun: LinkNoun, maxChoices: number): string[] {
  const titles = new Map(options.map((option) => [option.id, option.title]));
  const problems: string[] = [];
  if (choices.length > maxChoices) problems.push(`Choose at most ${maxChoices} ${noun.plural}`);
  for (const choice of choices) {
    const title = titles.get(choice.id);
    if (title === undefined) {
      problems.push(`A chosen ${noun.singular} no longer exists: remove it from the list`);
      continue;
    }
    const problem = roleProblem(choice.role);
    if (problem) problems.push(`${problem} (${title})`);
  }
  return problems;
}

function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/** The logo on the same white chip the website uses, or the initials when there is none (or it cannot be loaded). */
function Thumb({ image, title, large = false }: { image?: string; title: string; large?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = Boolean(image) && failedSrc !== image;
  return (
    <span
      aria-hidden="true"
      className={`${large ? 'h-12 w-12' : 'h-9 w-9'} flex flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white/90 p-1`}
    >
      {usable ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" onError={() => setFailedSrc(image ?? null)} />
      ) : (
        <span className="text-[10px] font-bold leading-none text-[#0A0A0A]/70">{initialsOf(title)}</span>
      )}
    </span>
  );
}

const ICON_BUTTON_BASE =
  'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-30';
const ICON_BUTTON = `${ICON_BUTTON_BASE} border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/10`;
const ICON_BUTTON_DANGER = `${ICON_BUTTON_BASE} border-red-400/25 text-red-300 hover:bg-red-400/20`;

function Chevron({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  );
}

function Cross() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

interface LinkPickerProps {
  /** Unique on the page: the prefix of every element id of this picker. */
  idPrefix: string;
  /** The label above the picker. */
  label: string;
  noun: LinkNoun;
  options: readonly LinkOption[];
  value: readonly LinkChoice[];
  onChange: (next: LinkChoice[]) => void;
  /** Whether the order of the chosen entries is shown to visitors (it is for an event's sponsors, not for a sponsor's events). */
  ordered: boolean;
  /** Under the list: when a saved change reaches the public site. */
  publicNote: string;
  /** Shown above the list when something about the whole selection needs saying (for example that the sponsor is hidden). */
  notice?: string;
  disabled?: boolean;
  /** Classes of the label, so the picker matches the form it sits in. */
  labelClassName?: string;
}

export default function LinkPicker({
  idPrefix,
  label,
  noun,
  options,
  value,
  onChange,
  ordered,
  publicNote,
  notice,
  disabled = false,
  labelClassName = 'block text-xs text-[#C9A84C] font-semibold',
}: LinkPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const optionsById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const chosenIds = useMemo(() => new Set(value.map((choice) => choice.id)), [value]);
  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => !chosenIds.has(option.id) && (needle === '' || `${option.title} ${option.detail ?? ''}`.toLowerCase().includes(needle)));
  }, [options, chosenIds, query]);

  const listId = `${idPrefix}-listbox`;
  const optionId = (index: number) => `${idPrefix}-option-${index}`;
  const rolesId = `${idPrefix}-roles`;
  const activeIndex = Math.min(active, Math.max(available.length - 1, 0));

  useEffect(() => {
    if (open) document.getElementById(`${idPrefix}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, idPrefix]);

  function add(option: LinkOption) {
    onChange([...value, { id: option.id, role: option.defaultRole }]);
    setQuery('');
    setOpen(false);
    setAnnouncement(`${option.title} added. ${value.length + 1} chosen.`);
    inputRef.current?.focus();
  }

  function remove(choice: LinkChoice, title: string) {
    onChange(value.filter((candidate) => candidate.id !== choice.id));
    setAnnouncement(`${title} removed. ${value.length - 1} chosen.`);
  }

  function move(index: number, delta: -1 | 1, title: string) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setAnnouncement(`${title} moved to position ${target + 1} of ${value.length}.`);
  }

  function setRole(id: string, role: string) {
    onChange(value.map((choice) => (choice.id === id ? { ...choice, role } : choice)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive(Math.min(activeIndex + 1, available.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive(Math.max(activeIndex - 1, 0));
        break;
      case 'Enter':
        // Never submits the form: Enter here means "add the highlighted entry".
        event.preventDefault();
        if (open && available[activeIndex]) add(available[activeIndex]);
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        } else if (query !== '') {
          setQuery('');
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div role="group" aria-labelledby={`${idPrefix}-label`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label id={`${idPrefix}-label`} htmlFor={`${idPrefix}-search`} className={labelClassName}>
          {label}
        </label>
        <span className="text-[11px] text-white/60">{value.length === 0 ? 'None chosen' : `${value.length} chosen`}</span>
      </div>
      <p id={`${idPrefix}-hint`} className="mb-3 text-[11px] text-white/60">
        Choose as many as you like and give each the role it has {ordered ? 'on this event' : 'at that event'}: Sponsor, Partner, Sponsor &amp; Partner, or
        your own words (up to {ROLE_MAX_LENGTH} characters).
        {ordered ? ' They appear on the event page in this order, grouped by role.' : ''}
      </p>

      {notice && (
        <p role="note" className="mb-3 border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          {notice}
        </p>
      )}

      <ul aria-label={`Chosen ${noun.plural}`} className="mb-3 space-y-2">
        {value.map((choice, index) => {
          const option = optionsById.get(choice.id);
          const title = option?.title ?? `A ${noun.singular} that no longer exists`;
          const problem = roleProblem(choice.role);
          const roleInputId = `${idPrefix}-role-${choice.id}`;
          const errorId = `${roleInputId}-error`;
          return (
            <li key={choice.id} className="rounded-sm border border-[#C9A84C]/15 bg-[#111111] p-3">
              {/* On a phone the name and the remove button share the first line and the role (with the move buttons) has the second, so a role is never cut short; from md up everything sits on one line. */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 md:grid-cols-[minmax(0,1fr)_22rem_auto] md:gap-x-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Thumb image={option?.image} title={title} large />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-white">{title}</p>
                    {option?.detail && <p className="break-words text-xs text-white/60">{option.detail}</p>}
                    {option?.note && <p className="break-words text-[11px] text-amber-400">{option.note}</p>}
                    {!option && <p className="text-[11px] text-red-300">It will be dropped when you save.</p>}
                  </div>
                </div>
                <div className="col-span-2 row-start-2 flex items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={roleInputId} className="sr-only">
                      Role of {title}
                    </label>
                    <input
                      id={roleInputId}
                      type="text"
                      list={rolesId}
                      value={choice.role}
                      onChange={(event) => setRole(choice.id, event.target.value)}
                      disabled={disabled}
                      placeholder="Role, e.g. Sponsor"
                      autoComplete="off"
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={problem ? errorId : undefined}
                      className={`w-full min-h-11 rounded-sm border bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none ${
                        problem ? 'border-red-400/25' : 'border-[#C9A84C]/20 focus:border-[#C9A84C]'
                      }`}
                    />
                  </div>
                  {ordered && (
                    <>
                      <button type="button" className={ICON_BUTTON} disabled={disabled || index === 0} onClick={() => move(index, -1, title)} aria-label={`Move ${title} up`}>
                        <Chevron direction="up" />
                      </button>
                      <button type="button" className={ICON_BUTTON} disabled={disabled || index === value.length - 1} onClick={() => move(index, 1, title)} aria-label={`Move ${title} down`}>
                        <Chevron direction="down" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className={`${ICON_BUTTON_DANGER} col-start-2 row-start-1 md:col-start-3`}
                  disabled={disabled}
                  onClick={() => remove(choice, title)}
                  aria-label={`Remove ${title}`}
                >
                  <Cross />
                </button>
              </div>
              {problem && (
                <p id={errorId} role="alert" className="mt-2 text-[11px] text-red-300">
                  {problem} ({choice.role.trim().length} now).
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <datalist id={rolesId}>
        {ROLE_SUGGESTIONS.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>

      {/* The list floats over the page below the search box, so opening or closing it never moves the controls under it
          (a list that collapsed on blur would shift a Save button between the press and the release of a click). */}
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <input
          ref={inputRef}
          id={`${idPrefix}-search`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={open && available.length > 0 ? optionId(activeIndex) : undefined}
          aria-describedby={`${idPrefix}-hint`}
          value={query}
          disabled={disabled}
          placeholder={options.length === 0 ? `There are no ${noun.plural} to choose from yet` : `Search ${noun.plural} to add…`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-11 rounded-sm border border-[#C9A84C]/20 bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#C9A84C] focus:outline-none disabled:opacity-50"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={`${noun.plural} that can be added`}
          hidden={!open || available.length === 0}
          className="absolute left-0 right-0 z-30 mt-1 max-h-[400px] overflow-y-auto rounded-sm border border-[#C9A84C]/30 bg-[#111111] shadow-2xl"
        >
          {available.map((option, index) => (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              // Keep the focus in the search box: a click or tap on an entry must not blur it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(option)}
              onMouseEnter={() => setActive(index)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 ${index === activeIndex ? 'bg-[#C9A84C]/15' : ''}`}
            >
              <Thumb image={option.image} title={option.title} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{option.title}</span>
                {(option.detail || option.note) && (
                  <span className="block truncate text-xs text-white/60">{[option.detail, option.note].filter(Boolean).join(' · ')}</span>
                )}
              </span>
              <span aria-hidden="true" className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#C9A84C]">
                Add
              </span>
            </li>
          ))}
        </ul>
        {open && available.length === 0 && (
          <p className="absolute left-0 right-0 z-30 mt-1 rounded-sm border border-[#C9A84C]/30 bg-[#111111] px-3 py-3 text-xs text-white/60 shadow-2xl">
            {options.length === 0
              ? `There are no ${noun.plural} yet.`
              : query.trim() !== ''
                ? `No ${noun.plural} match “${query.trim()}”.`
                : `Every ${noun.singular} is already chosen.`}
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] text-white/60">{publicNote}</p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
