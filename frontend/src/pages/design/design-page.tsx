import { useRef, useState, type ReactNode } from 'react';
import type { Word } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { PlantIcon, SeedIcon } from '../../components/garden-artwork';
import { TopicProgress, topicStages } from '../../components/topic-progress';
import { WordCard } from '../../components/word-card';
import { PracticeModeCards } from '../practice/practice-mode-cards';
import './design-page.css';
import { DashboardConcept } from './dashboard-concept';
import { GnomeConcept } from './gnome-concept';
import { GnomeDesigns } from './gnome-designs';

const word: Word = {
  id: 'design-demo',
  lemma: 'Baum',
  article: 'der',
  plural: 'Bäume',
  pos: 'noun',
  english: 'tree',
  level: 'A1',
  de: 'Der Baum steht im Garten.',
  en: 'The tree is in the garden.',
  growth: 2,
};
const sections = [
  'Dashboard concept',
  'Garden gnomes',
  'Foundations',
  'Actions',
  'Inputs',
  'Study cards',
  'Growth & status',
  'Patterns',
  'Feedback',
  'Audit',
];
const colors = [
  ['Canvas', '--canvas', 'Warm background behind every page.'],
  ['Surface', '--surface', 'Panels, cards, fields and dialogs.'],
  ['Navigation', '--navigation', 'Persistent sidebar and phone header.'],
  ['Primary', '--accent', 'The next important action, including garden actions.'],
  ['Primary hover', '--accent-hover', 'Hovered primary actions.'],
  ['On primary', '--on-accent', 'Text on primary actions.'],
  ['Secondary', '--secondary', 'Supporting actions and tools.'],
  ['Secondary hover', '--secondary-hover', 'Hovered secondary actions.'],
  ['Action text', '--action-text', 'Text on secondary actions.'],
  ['Text', '--text', 'Default body copy and headings.'],
  ['Muted', '--muted', 'Supporting copy, metadata and placeholders.'],
  ['Border', '--border', 'Dividers and control boundaries.'],
  ['Focus', '--focus', 'Keyboard focus, with a 3px offset.'],
];
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={`design-${title}`} className="design-section" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Example({
  title,
  usage,
  children,
}: {
  title: string;
  usage: string;
  children: ReactNode;
}) {
  return (
    <article className="design-example">
      <div className="design-specimen">{children}</div>
      <h3>{title}</h3>
      <p className="muted small">{usage}</p>
    </article>
  );
}
export function DesignPage() {
  const [revealed, setRevealed] = useState(false);
  const [direction, setDirection] = useState<'recognition' | 'production'>('recognition');
  const [notice, setNotice] = useState('Try a control to preview its interaction.');
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="design-page">
      <p className="eyebrow">GERMAN GARDEN · DESIGN REFERENCE</p>
      <Heading title="A garden of familiar elements">
        The current visual language, where it belongs, and what could be clearer.
      </Heading>
      <p className="design-intro">
        Live components and illustrative samples from the app. These demos use sample vocabulary and
        local state; they do not save ratings or change your garden.
      </p>
      <div className="design-index" aria-label="Design sections">
        {sections.map((title) => (
          <button
            key={title}
            onClick={() =>
              document.getElementById(`design-${title}`)?.scrollIntoView({ block: 'start' })
            }
          >
            {title}
          </button>
        ))}
      </div>

      <Section title="Dashboard concept">
        <p>
          The garden dashboard uses playful titles, literal counts, and compact SVG miniature
          scenes. These examples share the home page’s components and use sample data. “Due today”
          includes later today; the review button counts words due now.
        </p>
        <DashboardConcept />
      </Section>
      <Section title="Garden gnomes">
        <p>
          Leave a patch waiting for review and a few unwelcome guests start to appear. Evil garden
          gnomes gather among the wilted plants, looking far too pleased with themselves.
        </p>
        <GnomeConcept />
        <GnomeDesigns />
      </Section>
      <Section title="Foundations">
        <p>
          Quiet, warm surfaces support focused study. Green connects actions to the garden; blue
          marks reviews due. Use words alongside color to explain meaning.
        </p>
        <div className="design-swatches">
          {colors.map(([name, color, use]) => (
            <div className="design-swatch" key={name}>
              <div style={{ background: `var(${color})` }} />
              <h3>{name}</h3>
              <code>{color}</code>
              <p className="small muted">{use}</p>
            </div>
          ))}
        </div>
        <div className="design-grid">
          <Example
            title="System typography"
            usage="Native system sans-serif. These samples use the shared type tokens. Page headings become 28px on phones; vocabulary becomes 30px on narrow phones."
          >
            <div className="design-type-heading">Page · 32px / 600</div>
            <div className="design-type-dialog">Dialog · 24px / 620</div>
            <h2>Section · 18px / 620</h2>
            <h3>Compact heading · 16px / 620</h3>
            <p>Body · 15px / 1.5</p>
            <p className="design-type-context muted">Answer context and feedback · 14px</p>
            <p className="small muted">Supporting text · 13px</p>
            <span className="design-type-caption">Caption · 12px</span>
            <div className="design-type-word">Baum · 38px</div>
            <p className="design-type-example">Example sentence · 18px</p>
            <p className="design-type-reading">Reading and conversation · 17px</p>
          </Example>
          <Example
            title="Spacing & shape"
            usage="Common gaps: 8, 12, 16, 20, 24 and 32px. Panels use 24px corners; compact dashboard panels use 18px; buttons use 20px; fields use 14px."
          >
            <div className="panel">
              <h3>Soft surfaces, clear groups</h3>
              <p className="muted">
                24px panel padding. A subtle border and shadow separate content from the canvas.
              </p>
            </div>
          </Example>
        </div>
      </Section>
      <Section title="Actions">
        <div className="design-grid">
          <Example
            title="Primary"
            usage="Advance the current flow: Keep, Plant, Start session. Dashboard actions turn dark green when actionable."
          >
            <button
              className="primary"
              onClick={() => setNotice('Primary action selected — demo only.')}
            >
              Start session
            </button>
          </Example>
          <Example
            title="Secondary & text"
            usage="Supporting choices, reveal, hints and navigation. Underlined text actions are used for Exit round and changing activities."
          >
            <div className="actions">
              <button onClick={() => setNotice('Secondary action selected — demo only.')}>
                Show translation
              </button>
              <button
                className="practice-text-action"
                onClick={() => setNotice('Exit round selected — demo only.')}
              >
                Exit round
              </button>
            </div>
          </Example>
          <Example
            title="Disabled"
            usage="Prevent conflicting writes during saves, and unavailable AI actions. Explain why the action is unavailable nearby."
          >
            <button disabled>Saving…</button>
          </Example>
          <Example
            title="Control sizes"
            usage="Standard actions use 15px text. Dashboard, table and secondary study tools use the compact 13px size. Both share the same action palette."
          >
            <div className="actions">
              <button onClick={() => setNotice('Standard action selected — demo only.')}>
                Standard action
              </button>
              <button
                className="design-compact-action"
                onClick={() => setNotice('Compact action selected — demo only.')}
              >
                Compact action
              </button>
            </div>
          </Example>
          <Example
            title="Review ratings"
            usage="Only shown after reveal. These are self-assessments, not success/error colors. Actual review delays come from the scheduler."
          >
            <div className="grade-actions">
              {['Again', 'Hard', 'Good', 'Easy'].map((label) => (
                <button
                  key={label}
                  onClick={() => setNotice(`${label} selected — no rating saved.`)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Example>
        </div>
        <p className="small muted" role="status">
          {notice}
        </p>
      </Section>
      <Section title="Inputs">
        <div className="design-grid">
          <Example
            title="Search & selection"
            usage="Topic search and word filters. Keep a visible label; use placeholders only as examples."
          >
            <label htmlFor="design-search">Search words</label>
            <input id="design-search" type="search" placeholder="German or English" />
            <label htmlFor="design-level">Level</label>
            <select id="design-level" defaultValue="A1">
              <option>A1</option>
              <option>A2</option>
              <option>B1</option>
            </select>
          </Example>
          <Example
            title="Free text & optional filters"
            usage="Learning goals, matcher guidance, and practice replies. AI runs only after an explicit action."
          >
            <label htmlFor="design-goal">What would you like to practise?</label>
            <textarea id="design-goal" placeholder="Words for an evening with friends" />
            <label className="other-levels-toggle">
              <input type="checkbox" /> Show other levels
            </label>
          </Example>
        </div>
        <details className="disclosure">
          <summary>Progressive disclosure</summary>
          <div className="disclosure-body">
            Use for optional matcher guidance and secondary details, keeping the main flow short.
          </div>
        </details>
      </Section>
      <Section title="Study cards">
        <p>
          One shared word card for discovery, practice and review. German answers lead after reveal;
          English moves into a subdued context block. Reserved space keeps hints and reveal from
          moving the footer.
        </p>
        <div className="design-study">
          <div className="actions design-toolbar">
            <label htmlFor="design-direction">Direction</label>
            <select
              id="design-direction"
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as typeof direction);
                setRevealed(false);
              }}
            >
              <option value="recognition">DE → EN</option>
              <option value="production">EN → DE</option>
            </select>
            <button onClick={() => setRevealed(false)}>Reset card</button>
          </div>
          <WordCard
            word={word}
            revealed={revealed}
            direction={direction}
            onReveal={() => setRevealed(true)}
          />
        </div>
        <div className="design-grid design-notes">
          <div>
            <h3>Discovery</h3>
            <p className="muted">
              Not now, Learned and Keep sit below the card. The seed bag shows confirmed additions.
            </p>
          </div>
          <div>
            <h3>Practice</h3>
            <p className="muted">
              Direction and progress sit above; Previous and Next sit below. Forms is a secondary
              tool. Practice never changes growth.
            </p>
          </div>
          <div>
            <h3>Review</h3>
            <p className="muted">
              Nouns require an article choice before reveal. Ratings sit below; Forms appears after
              reveal. Each rated seed is planted immediately.
            </p>
          </div>
        </div>
      </Section>
      <Section title="Growth & status">
        <p>
          Plant artwork communicates learning progress. A bud marks unlocked production; a fully
          open flower needs both tracks to mature. Due plants wilt; Learned words never wilt.
        </p>
        <div className="design-plants">
          <div>
            <SeedIcon />
            <span>Seed</span>
          </div>
          {[0, 1, 2, 3, 4, 5].map((growth) => (
            <div key={growth}>
              <PlantIcon
                word={{
                  ...word,
                  growth,
                  production_unlocked: growth >= 2,
                  production_growth: growth,
                }}
              />
              <span>Growth {growth}</span>
            </div>
          ))}
          <div>
            <PlantIcon word={{ ...word, growth: 3, review_due: true }} />
            <span>Review due</span>
          </div>
          <div>
            <PlantIcon word={{ ...word, learned: true }} />
            <span>Learned</span>
          </div>
        </div>
        <div className="design-grid">
          <Example
            title="Status chips"
            usage="Word lists use explicit labels. Grown and Learned share a visual category but have different scheduling behavior."
          >
            <div className="actions">
              {topicStages.map(([key, label]) => (
                <span key={key} className={`badge status-chip stage-${key}`}>
                  {label}
                </span>
              ))}
            </div>
          </Example>
          <Example
            title="Topic distribution"
            usage="Explore topics and topic summaries show the five categories together. Stronger fills distinguish segments at small sizes."
          >
            <TopicProgress counts={{ unseen: 12, seeds: 3, planted: 8, due: 4, grown: 6 }} />
          </Example>
        </div>
      </Section>
      <Section title="Patterns">
        <h3>Practice mode cards</h3>
        <p className="muted">
          Topic and seed-bag practice offer all three modes. Guided rounds offer Conversation and
          Reading after flashcards.
        </p>
        <PracticeModeCards
          aiAvailable
          onSelect={(mode) => setNotice(`Selected ${mode} — demo only.`)}
        />
        <p className="small muted" role="status">
          {notice}
        </p>
        <div className="design-grid">
          <Example
            title="Progress"
            usage="Review and practice flashcards pair a bar with visible counts. Practice coverage is not mastery."
          >
            <div className="review-progress">
              <div className="review-progress-counts">
                <span>3 of 5 words</span>
                <span>2 remaining</span>
              </div>
              <progress value={3} max={5} aria-label="Sample card progress" />
            </div>
          </Example>
          <Example
            title="Badges & target words"
            usage="Compact metadata, seed bag capacity, and target vocabulary. A checkmark indicates a used practice word."
          >
            <div className="actions">
              <span className="badge">3 / 20</span>
              <span className="badge">der Baum</span>
              <span className="badge used">✓ der Garten</span>
            </div>
          </Example>
          <Example
            title="Conversation"
            usage="Learner messages align right with a green surface; assistant messages use the standard panel. Feedback follows a divider."
          >
            <div className="panel message user" lang="de">
              Im Garten steht ein Baum.
            </div>
            <div className="panel message" lang="de">
              Was wächst noch in deinem Garten?
            </div>
          </Example>
          <Example
            title="Dialogs"
            usage="Upcoming reviews uses a centered dialog; Forms uses a right-side sheet, full width on phones. Both support Escape, Close and backdrop dismissal."
          >
            <button onClick={() => dialog.current?.showModal()}>Preview dialog</button>
            <dialog
              ref={dialog}
              className="upcoming-reviews"
              aria-labelledby="design-dialog-title"
              onClick={(event) => {
                if (event.target === event.currentTarget) dialog.current?.close();
              }}
            >
              <div onClick={(event) => event.stopPropagation()}>
                <div className="upcoming-reviews-header">
                  <h2 id="design-dialog-title">Dialog example</h2>
                  <button onClick={() => dialog.current?.close()}>Close</button>
                </div>
                <p>
                  Focused information without losing your place. Closing returns focus to the
                  trigger.
                </p>
              </div>
            </dialog>
          </Example>
        </div>
        <h3>Layout & navigation</h3>
        <Example
          title="Page navigation"
          usage="Titles and context sit left; return links and page actions sit right, wrapping below on narrow screens. Return links preserve the current word set. Forward flow links use buttons."
        >
          <div className="page-heading">
            <div>
              <h2>Reading</h2>
              <p className="muted">Selected topic</p>
            </div>
            <nav
              className="page-navigation page-heading-actions"
              aria-label="Example page navigation"
            >
              <a
                href="#/design"
                onClick={(event) => {
                  event.preventDefault();
                  setNotice('Return to scoped Practice — demo only.');
                }}
              >
                ← Practice
              </a>
            </nav>
          </div>
        </Example>
        <p>
          Desktop uses a 190px sidebar. At 760px and below it becomes a compact expandable header;
          study cards fit the screen, ratings become two columns, and topic tables become stacked
          rows. Study content is capped at 690px; AI activities use the available page width.
          Dashboard cards move from four to two to one column.
        </p>
      </Section>
      <Section title="Feedback">
        <div className="design-grid">
          <Example
            title="Loading"
            usage="A sprout grows leaves and a golden bloom while waiting. Reduced motion shows a still plant. Keep navigation, headings and independent controls available; the animation does not represent learning progress."
          >
            <Loading />
          </Example>
          <Example
            title="Errors"
            usage="Use the shared alert with a specific message. Failed saves preserve prior state; offer retry in the affected flow."
          >
            <ErrorNotice error={new Error('Example: Unable to load words. Please try again.')} />
          </Example>
          <Example
            title="Empty state"
            usage="Explain what is missing and what the learner can do next. Never imply that practice plants seeds."
          >
            <Empty>Your garden is ready to grow. Review a seed to plant it.</Empty>
          </Example>
        </div>
      </Section>
      <Section title="Audit">
        <p>
          Source audit of the current implementation. These are recommendations, not changes to the
          learning flows.
        </p>
        <div className="design-audit">
          {[
            [
              'Keep',
              'Shared study components',
              'WordCard, PlantIcon, TopicProgress and practice mode cards already provide consistency across flows. This page renders those actual components.',
            ],
            [
              'Keep',
              'Color tokens',
              'Canvas, surfaces, text, muted text, navigation, focus and action colors use shared tokens. Status chips and chart fills retain distinct semantic palettes.',
            ],
            [
              'Improve',
              'Layered style overrides',
              'Word cards, sidebar rules and responsive layouts are defined in several places in styles.css. Consolidate by component to make the final appearance easier to predict.',
            ],
            [
              'Clarify',
              'Shape and type scales',
              'Panels use 18px and 24px radii; controls vary between 12px, 14px and 20px. Most differences suit density, but the scale is implicit. Name compact and standard variants.',
            ],
            [
              'Verify',
              'Accessibility across states',
              'Focus rings, visible labels and accessible plant descriptions exist. Check contrast for muted metadata, keyboard operation of every popup, and long labels at phone widths before standardizing.',
            ],
            [
              'Clarify',
              'Two semantic palettes',
              'Status chips use pale fills; distribution bars use stronger versions of the same categories. Keep this intentional distinction documented and always retain labels or accessible descriptions.',
            ],
          ].map(([status, title, text]) => (
            <article key={title}>
              <span className="badge">{status}</span>
              <div>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
