# German Garden: UX decisions

A German vocabulary web app. Users discover words they care about, practise them, and watch them grow in a "garden" as they remember them better over time.

For the learning flows, scheduling rules, and saved progress, see [How German Garden works](vocab-garden-how-it-works.md).

## Glossary

| Term | Meaning |
|---|---|
| **CEFR level** | The learner's or word's language level: A1, A2 or B1. Word levels come from the official Goethe-Institut word lists. |
| **Topic** | An everyday-life theme words are grouped by, e.g. "At the doctor", "Shopping", "Finding a flat". About 25 in total. A word can belong to several topics. |
| **Seed bank** | All words the user hasn't seen yet. The vocab matcher draws from it. |
| **Vocab matcher** | The screen where users go through words from the seed bank one card at a time and decide what to do with each. |
| **Seed bag** | The user's current set of newly kept words, not yet planted. At most 20. |
| **Garden** | All words the user has planted, organised by topic. It is also the home screen. |
| **Growth stage** | How well a user remembers a word, from seedling to fully grown. Determined by spaced repetition. |
| **Practice** | Flashcards (including Context), chat, or reading. Never changes growth stages. |
| **Review** | A short knowledge check on a set of words. The only thing that changes growth stages. |

## Users and context
- Flashcards and review cards show compact regional-usage labels (Germany, Austria, Switzerland) beside the level and part of speech, before and after reveal. Topic word lists show the same labels beside the word. Use verified Goethe/ÖSD regional annotations for the taught sense; unverified or ambiguous entries stay unlabelled. Labels describe usage, not exclusivity. They do not change discovery, learning progress, or review behavior.
- Distinct verb meanings and constructions are separate learning entries (for example, verbieten and verboten sein, or in Rente gehen and in Rente sein). Keep harmless spelling variants and optional reflexive pronouns together. When splitting an old grouped entry, retain its progress on one primary sense; additional senses start unseen. Move examples to the matching sense and merge into existing words rather than creating duplicates.
- Noun dictionary entries include their canonical article and full plural, including unchanged forms such as Lehrer. Vocabulary corrections preserve learner progress. Confirmed duplicate words merge into the canonical ID: keep all review history, Learned marks and planted status, and retain the most recently reviewed schedule independently for recognition and production (canonical wins timestamp ties). Do not invent plurals for nouns without an ordinary plural in the taught sense.
- The current learners are the author and her husband.
- The hosted app uses private email/password accounts created by the garden owner. Each account has its own progress, shared across devices; there is no public signup.
- Imported accounts can sign in using their profile username (for example, `leo`) and password. Full email addresses are also accepted.
- Sign-in uses a panel with labelled Username and Password fields, 20px spacing between form groups, inline errors, and a left-aligned primary Sign in button. While submitting, the button is disabled and reads “Signing in…”. Submission reads the current field values, including browser/password-manager autofill.
- Opening the sign-in URL with a saved session restores and validates it before showing the form; a valid session goes straight to the garden, including installed web apps whose launch URL is the sign-in page. Invalid sessions show the form without a redirect loop.
- The sidebar farmer artwork also serves as the browser favicon and Apple home-screen icon.
- Clicking the farmer icon signs out the current browser session and returns to sign-in. Other devices stay signed in, and the learner can immediately sign in again or switch accounts.
- The app uses Supabase accounts in development and production. Python is reserved for offline vocabulary creation and read-only imports; there is no local profile chooser.
- The signed-in sidebar appears from browser login state while profile and page data load. Session bootstrap reads only the learner name, level, and AI availability, never vocabulary or learning progress. Topic names load separately when needed. Signed-in pages mount alongside session bootstrap. Headings, navigation, search/filter inputs, and practice-mode links stay available while independent data loads; loading/error messages are scoped to the affected content. AI actions wait for confirmed availability. Card decisions and review ratings remain disabled during saves to avoid conflicting writes. Server requests still verify authentication.
- Supports laptops and phones. At phone widths (760px and below), navigation becomes a compact header with an expandable menu, and study flows use the full screen width. Opening another page closes the menu.
- On phones, Find words starts with collapsed topic selection and seed bag panels, review ratings use a two-by-two grid, Context opens as a full-width popup, and topic word tables become stacked rows while retaining sorting.
- The phone garden includes visible topic links and a labelled Seed bag button in Fresh finds, so navigation does not require hovering or selecting small artwork targets.
- Not in scope: social features and adding your own vocabulary.

## Word states

| State | How a word gets there | Visible by default |
|---|---|---|
| In seed bank | Not seen yet (starting state of every word) | In topic word lists, but not as garden plants |
| In seed bag | Marked "Keep" in the vocab matcher or added from a topic word list | Yes |
| Planted | The word received its first review rating | Yes, in the garden under each of its topics |
| Learned | Marked "Learned" in the vocab matcher, or "Mark as Learned" after both review tracks mature. Counts as fully grown, permanently. | Yes, in garden plots and topic word lists |
| Archived | Marked "Not now" in the vocab matcher (not relevant at the moment) | In topic word lists, but not as garden plants |

Topic word lists apply the level visibility rules described below.

## Seed bag
- There is only ever one seed bag.
- Adding a word from a topic updates that row from the server-confirmed result. It does not wait for unrelated page refreshes; failed saves leave the row unchanged. Duplicate additions preserve the existing bag/planted state.
- It holds up to 20 words.
- Words in the seed bag can be practised and reviewed at any time.
- Reviewing a seed plants that word immediately, regardless of its rating, and removes it from the bag. Practice does not plant words.
- At 20 seeds, the bag is full. Review a seed to plant it and make room; there is no separate planting action.

## Growth
- Planted words have independent recognition (DE → EN) and production (EN → DE) schedules. Recognition begins with the first review rating. Production permanently unlocks when recognition reaches sapling (a 7-day interval), and is immediately due for the next session.
- When production unlocks, it inherits recognition's ease after the unlocking rating. Its interval and repetition count start fresh; subsequent ease changes are tracked independently.
- Recognition drives early growth. Each track matures at a 55-day interval; a plant is fully grown only when both tracks are mature. Naturally mature words remain scheduled and may wilt.
- Production unlocking adds a closed flower bud; production progress gradually opens it. The flower opens fully only when both tracks are mature. Lapses can close the flower again without relocking production.
- Plants wilt when either track is due, appearing drooped and muted. Wilting itself does not change growth stages; Learned words never wilt.
- Seedlings and saplings are shown as young plants with slender green stems. Seedlings have a shorter stem and three leaves; saplings have four leaves.
- Only reviews change a word's growth stage, using spaced repetition.
- Practice never changes growth. Flashcards just show words one after another, with no grading.

## Garden gnomes
- All six designs use dimensional SVG materials consistent with the review icon: shaded hats and coats, warm highlighted faces, textured beards, leather boots, and detailed props. The original keeps its familiar silhouette. Shared artwork renders both garden inhabitants and the design gallery.
- When gnomes are present, the home and topic review actions retain their normal labels and add a compact boot-kicking-a-gnome icon before the text, matching the seed bag icon’s leading placement and dimensional SVG style. The icon uses a 36px canvas with a shaded, stitched leather boot and an airborne gnome, retaining detailed artwork at button scale. Its tooltip and accessible label say “Let’s kick the gnomes out”. The icon reflects gnomes in the action’s own scope and disappears when none remain; the home action retains its due-word count and only appears when reviews are due.
- All garden views use a weighted mix of six designs: original gnome 60%, Foreman 14%, Seed Thief 10%, Squatter 8%, Hexer 5%, and Saboteur 3%. Design is seeded by topic and permanent gnome slot, independently of hat color, and stays stable across refreshes and changes in count. Props are decorative only.
- Each gnome gets a pseudorandom hat color from a shared palette of brick red, plum, ochre, slate blue, forest green, and rust. Color is seeded by topic and gnome slot, remaining stable across refreshes, views, and changes in gnome count. Repeated colors are allowed.
- Gnomes gather in the soil among plants in each topic plot, including the home, topic, and practice gardens. The count is based on that plot’s oldest currently overdue recognition or unlocked production schedule across planted, non-Learned words. Seeds and Learned words never attract gnomes.
- No gnomes before 12 hours overdue; one at 12 hours, then one additional gnome at each full day overdue through day five (two at one day, three at two days, four at three days, five at four days, six at five days). Six is the maximum, including after seven days.
- After a review, recalculate from the remaining overdue schedules. Gnomes leave as the oldest overdue age falls below their thresholds; they all leave when no schedule is at least 12 hours overdue. Rating a word does not automatically remove a gnome if another equally old schedule remains. Again/Hard production ratings leave recognition unchanged, so that track may still attract gnomes.
- Practice does not remove gnomes. Gnomes never change growth, ratings, or schedules and never remove words. Counts refresh every minute while garden views are open and when review changes refresh their data. Gnomes do not block plant or topic selection.

## Home screen = the garden
- When an A1 or A2 learner has no unseen words remaining at their current level across the whole seed bank, show a compact level-up suggestion at the top right in the page heading. A1 advances to A2; A2 advances to B1. Learned, kept, planted, and Not now words count as seen. Say “learned every word” only when all are marked Learned; otherwise say “explored every word”. Do not suggest advancement for B1, an unset level, or an empty level catalogue. The learner explicitly selects **Level up to A2/B1**; save the new level and refresh level-dependent views, preserving all progress. Recheck eligibility on save and reject stale or duplicate advancements.
- Dashboard actions use dark green when actionable: **Practice hard words** when hard words exist, and **Find new words** when Words found today is zero. Find new words returns to the secondary style once a word has been added that day.
- The Extra care dashboard card shows the current hard-word count and offers **Practice hard words** only when that count is positive, opening the practice overview to start or resume a weak-word round. Zero words means no sessions and no button. Loading counts show a dash. The count uses the same current weak-word selection as practice and refreshes every minute.
- The home screen is an illustrated garden. Topics containing planted or learned words appear as plots; selecting a plot opens its topic page.
- **Find new words** opens the vocab matcher. **Review N words** reviews planted words across all topics and appears as a button only when reviews are currently due, with the due count. The main count shows words due now, including 0; unavailable counts show a dash. Pair the main count with “words due now” on the same line. In the action row beside the Upcoming calendar button, the smaller “N more due today” note shows max(0, due_today − due_now), so learners do not have to subtract the current count from a daily total.
- Fresh finds combines discovery and seed-bag access: Find new words sits beside a **Seed bag · N / 20** button with the garden’s small sack illustration. Today’s found count remains separate from current bag occupancy. The seed-bag button opens a compact dialog with the word list and **Practice** and **Plant** actions when it contains seeds. An empty bag offers Find words; a full bag explains that reviewing a seed makes room. The button is disabled while bag data is unavailable. Close, Escape and backdrop dismissal return focus to the trigger. The home illustration contains topic plots; seed-bag access is in Fresh finds. **Plant** starts a seed-bag review; it does not plant words without ratings.
- The sidebar provides Garden, Explore topics, Find words, Practice, and Review navigation.
- Above the garden, the planted total sits beside “Your garden” with a tiny SVG planter, not in a card. Three compact cards show **A little tending** (words due now as the main count, a smaller “N more due today” note beside the Upcoming calendar button, Review N words only when currently due, and Upcoming), **Fresh finds** (found today, Find new words, and Seed bag · N / 20), and **Extra care** (words to practise and Practice hard words when positive). Small perspective SVG illustrations sit beside the counts; actions sit below. The planted total counts reviewed words, while plots also include Learned words.
- Reviews due today includes overdue planted words and planted words scheduled before the end of the learner’s local calendar day, using the browser’s time zone. Each word counts once when either recognition or production is due; seeds and Learned words are excluded. This is a snapshot of current schedules, not a prediction of repeat reviews after ratings. Counts refresh every minute while the page is visible and after learning changes. Reviews remain available only when currently due.
- **Upcoming** is a compact calendar-icon button followed by the “N more due today” note; this group is aligned to the right of the card’s action row (also when it wraps), with an accessible label and Upcoming reviews tooltip. It opens a modal with the due-now count and a horizontal bar chart of future counts grouped by local calendar date. Each bar has a visible date and word count, with lengths scaled to the busiest scheduled day. Each planted word appears once, on the earliest of its recognition and unlocked production schedules. Already-due words appear only in the due-now count; seeds and Learned words are excluded. All scheduled future dates are shown, including later today. These are current schedules, not predictions of repeat reviews or future production unlocks. The modal supports Close, Escape, and backdrop dismissal.
- The app does not track time spent learning or store activity-timer sessions.

- The Fresh finds “found today” count counts distinct words first added to the seed bag on the learner’s local calendar day, from either discovery or topic additions. Words still count after planting or becoming Learned. Skipped words and words marked Learned without being kept do not count. Counts refresh with the garden summary; repeated keeps never count a word twice.
- Garden dashboard cards use three equal columns on desktop and stack on narrow screens. They share 16px padding, 76px-wide SVG illustrations, and compact 13px actions; keep the row short so the garden remains visible. The planted count is next to the page title and wraps beneath it when needed.

## Explore topics and topic pages
- Explore topics shows overall progress for the learner’s current level below the page heading and above the search: grown/learned words out of all words at that level, plus the shared Unseen, Skipped / Not now, Seeds, Planted, Review due, and Grown / Learned breakdown. Count each vocabulary word once, including words without a topic; topic search does not change these totals. With no level selected, include all levels.
- Explore topics lists all topics, including empty ones, and supports searching by topic name. Selecting a topic opens its topic page.
- Topic progress is shown for the learner's CEFR level, split into Unseen, Skipped / Not now, Seeds, Planted, Review due, and Grown / Learned.
- Each topic page has a garden scene containing its planted and learned words, a progress summary, and a word list.
- Topic practice and review actions become available when the topic has planted words.
- The word list supports German/English search, status filters, and sorting by word, meaning, level, or status.
- By default, the list shows all statuses at the learner's level, plus seed-bag, planted, and learned words from other levels. **Show other levels** includes unseen and Not now words from other levels too.
- Words outside the seed bag and planted set have an **Add to bag** action, subject to the 20-word limit. This allows revisiting Not now words. Learned words are permanently complete and cannot return to the seed bag.
- Due words have a **Review** link that opens the topic's review set.
- Experimental: each word row has a **Related words** button that opens a popup with up to six words from the **Same family** (shared stems and compounds, such as *fahren* → *Abfahrt*, *Fahrkarte*, or *atmen* → *Atem*) and up to six **Related by topic** (words a learner would clearly associate with it, such as *Zug* → *Bahnhof*, *Gleis*; chosen offline by Claude from the vocabulary and stored with it, never generated while browsing). Many words have no related words; the popup then says so. Each related word shows its meaning and status. Selecting one shows its related words, with a return link to the previous word. The popup is read-only and never changes the seed bag or growth.

- Related words keeps **Typical objects** (from a verb) / **Verbs taking this object** (from a noun) separate from **Related by topic**. Only explicit offline-checked direct-object phrases appear in the object section, in both directions. Show the complete phrase with the correct case (for example, *einen Vertrag unterschreiben*, *eine Wohnung vermieten*, *Geld sparen*). A noun must be the typical accusative/dative object of that verb; shared topics, subjects, locations, and prepositional complements do not qualify. Never infer this relationship from parts of speech or reverse a topical association into an object pairing. Each section has at most six entries. Broad associations remain available under Related by topic.

- Explore topics places search and its right-aligned color legend on the same row, wrapping on smaller screens.
- Overall level progress sits in a full-width compact white card below the title, with a compact desktop layout: level heading, grown/learned total, and progress bar without a numeric legend. Segment counts remain available in tooltips and the accessible bar description. It wraps on narrower screens.
- Unseen words use gray; skipped (**Not now**) words use purple in progress bars, legends, and status chips. They have separate counts in overall level and topic progress. Adding a skipped word to the seed bag moves it into Seeds.

## Empty garden (new users)
- Accounts without a level first choose A1, A2, B1, or Not sure (starts with A1). They can optionally describe learning goals when AI is available.
- After setup, users land on the garden. Accounts with a level already configured skip setup.
- With no planted words, **Find new words** is the primary home action. Sidebar navigation remains available, and seeds can be practised or reviewed through the seed bag.
- A garden with no plots prompts the learner to review a seed to start growing.

## Vocab matcher
- Discovery level sampling adapts through the below-level and above-level affinity weights; there is no separate level-bias score and the learner’s declared level does not change automatically. Changing the declared level resets both below-level and above-level affinities to 1; saving the same level preserves them.
- **Guidance panel:** pick a topic (or let the app choose), and optionally describe in free text what kind of words you want, e.g. "words for a wine evening with friends". An LLM uses this to pick words from the seed bank.
- Opening Find words, choosing a topic, and moving between cards use the normal vocabulary selection rules immediately. They do not wait for automatic AI recommendations. AI guidance runs only when the learner submits a free-text request without choosing a specific topic.
- **Word card:** uses the same typography, spacing, reveal layout, and footer as review and practice. The selected topic is not repeated on the card. Discovery actions sit below the card.
- Returning to Find words keeps the current card when its cached state is still valid. Reconnecting must not replace it. If progress changed elsewhere in the app and the selection needs refreshing, show a loading state until the fresh card is ready rather than flashing an outdated card first.
- The next card is preloaded for each possible choice and shown while that choice saves. A saving indicator remains visible and further choices stay disabled until confirmation. Failed saves restore the previous card; concurrent changes use the server’s fresh selection. The seed bag shows confirmed progress only.
- **Actions per card:** Not now, Learned, Keep.
- After revealing the translation, **Context** opens the shared word-context popup using the current card’s word and topic, including after topic changes or automatic topic rotation. It reuses the same cached introduction and private conversation as practice/review. Closing it preserves the card and reveal state; opening it never records a discovery choice or changes the seed bag.
- Experimental: after the translation is shown, the card footer offers **Related words**, opening the same read-only popup as topic pages. It appears only after reveal because the popup shows meanings. Opening it never records a card decision.
- Experimental: after a **Keep** or **Learned** decision, the next card is a related word (Same family or Used together) 70% of the time, when one is available. It must still meet every normal rule: unseen, in the current topic with a sentence there, and at the sampled level (or the learner’s level as fallback). Otherwise, and after **Not now**, the next card is chosen as usual. This does not change topic rotation or level affinities.
- **Side panel:** the seed bag as a list of kept words, with actions to practise or review seeds.

## Practice and review
- The practice menu, Reading, and Conversation load only word counts before starting. Context loads only when opened from a card and uses that card’s word, current topic (or its example-sentence topic), and learner CEFR level.
- Review supports planted words across the whole garden, planted words in one topic, or the seed bag. Its **Plants / Seeds** switch keeps seeds separate from planted words and preserves the selected topic when switching back to plants. Practice opens through garden-wide weak-word rounds, topic practice, or seed-bag practice; its overview has no word-set switch.
- Topic practice includes its planted and Learned words, including words marked Learned directly in the matcher. Unseen and Not now words must first be added to the seed bag to practise them.
- Practice flashcards and review cards show each word's growth with the garden’s plant icon inside the card header, without a visible growth-stage or production-progress label. The icon retains an accessible description. AI practice shows its target vocabulary.
- Review format: reveal the card, then choose Again, Hard, Good, or Easy. The rating updates the selected review track and the word’s growth stage.
- Hard caps the rated track's next interval at one day: new and relearning tracks use 10 minutes; established and mature tracks use min(previous interval × 1.2, 1 day), preserving shorter calculated intervals. Other rating effects remain unchanged.
- On established review tracks (including mature tracks), Good increases ease by 0.05 and Easy by 0.20 before calculating the next interval. Good multiplies the previous interval by the updated ease; Easy also applies a 1.3 multiplier. New and relearning tracks keep their fixed Good (1 day) and Easy (4 days) steps without changing ease.
- Review mixes both directions and labels every card. Each word appears at most once per session; production takes priority when both tracks are due. Good or Easy production also applies the same rating to recognition, even if recognition is not due. Hard and Again production affect production only.
- A session covers one visit to Review for one selected word set. Refresh resumes the session; leaving Review or switching sets starts a new session. Session progress is local to the browser tab and account.
- Review ends when no unseen-in-this-session new or currently due words remain. Future reviews are not shown early. A completed session can leave due words in the garden.
- In review and practice, production prompts show the English meaning, part of speech and English example sentence when available. A **Hint** button reveals the first German letter followed by one spaced underscore for each remaining letter (for example, `B _ _ _`), without a “Hint:” prefix; spaces and punctuation are preserved; hints reset for each card and when switching direction. German examples, plurals and the answer stay hidden until reveal. Noun answers include the article.
- Immediately after a rating makes both tracks mature, Review offers **Mark as Learned** or **Keep reviewing**. Learned permanently completes both tracks, stops review and wilting, and remains available for practice. The choice is also offered after later mature ratings.
- Practice flashcards have a DE → EN / EN → DE toggle for both plants and seeds, including words whose production review is locked. Switching direction hides the answer again; practice never changes schedules or growth.
- Review and practice share the same word card. Noun articles and plurals stay hidden until reveal in both directions.
- After reveal in either direction, review and practice flashcards (standalone and guided) offer **Related words** beside Context, opening the same read-only popup as topic pages. Closing it preserves the revealed card, direction, and session position; opening it never records a rating or changes learning progress. Related words hides again when the direction or card changes.

- **Context** replaces the Forms grammar playground. Practice flashcards offer it at any time; Review offers it only after reveal, in either direction.
- Opening Context loads a short English meaning/usage introduction, generating it on demand if missing. The introduction contains no example sentences. Cache it across accounts by word, topic, CEFR level and prompt version; concurrent opens reuse the same generation. Use the current topic or, in mixed-topic sets, the card’s example-sentence topic. With no learner level set, use A2.
- Learners can ask follow-up questions, answered in English (German examples only when requested). Save conversations privately per account, word and topic across devices, retaining history across level changes. Clear conversation removes private messages while keeping the shared introduction. Use saved history as context for follow-ups, with the latest ten exchanges sent to the model to bound token use.
- Context opens in a side popup, full width on phones. Close, Escape and backdrop dismissal return focus to its button and preserve the card, direction, hint, reveal state, and review progress. Drafts survive closing/reopening on the same card. Saved content remains readable when AI is unavailable; failed sends preserve the draft and can be retried without duplicating a successful reply.
- Context never rates, plants, or changes schedules or growth. Learned words remain available.

- Study cards show level and part of speech in a compact header; Review also labels the review direction there. Practice places its direction selector outside the card. The word and example remain central; reveal and Context share a footer, with Context styled as a secondary tool.

- Revealed cards use the same answer layout in both directions: German word (with its article), plural, and German example first, with English meaning and example in a subdued context block below. This applies to practice and review.

- On DE → EN cards in review and practice, the German example sentence is hidden until the learner requests Hint or reveals the answer. The hint reveals only that sentence, not the plural or translation, and resets when the word or direction changes.
- Shared study cards reserve space for both prompt and revealed answer using overlapping layout faces. Concealed content is invisible and excluded from accessibility; hints and reveal keep the card and footer height stable, including wrapped sentences on phones.
- In both review directions, nouns with a known der/die/das article require an article choice before reveal. The card labels the choices “Choose the correct article.” Either choice reveals the answer with the correct article in the heading, without additional feedback text. No rating is saved automatically; the learner then chooses Again, Hard, Good, or Easy normally. Hints are unavailable before the choice so examples cannot reveal the article. Practice remains ungraded; nouns without a canonical article use normal reveal.
- Noun article choices appear directly beneath the heading inside the review card, close to the missing-article blank. The normal rating buttons appear below the card only after an article choice.
- Before the article choice, DE → EN noun review headings show a blank before the noun (for example, “___ Baum”); reveal replaces it with the correct article. EN → DE keeps the English prompt to avoid giving away the German word.

## Guided practice rounds
- Practice defaults to words needing attention: planted, non-Learned words whose recognition or rated production track has a latest rating of Again/Hard, or a scheduled interval strictly shorter than one day. This is the interval, not time remaining until due. Newly unlocked, unrated production tracks do not qualify on their own. A word counts once across tracks; old ratings do not qualify a word after its current schedules improve.
- Sort Again before Hard before other short-interval words, then shorter intervals and word ID. Weak-word sessions span the garden. Topic practice is a separate flow and does not filter by difficulty. Seed-bag practice remains a separate choice.
- The practice overview states how many words need attention and how many sessions cover them once (ceiling of word count / 5). Starting a round snapshots that ordered list into stable groups of up to five; the final group can be smaller. New weak words join the next round.
- Each session initially lists only its German words, including noun articles, without translations, difficulty reasons, or direction labels. It then offers optional flashcards or Skip to activity. Flashcards support both directions and Context. Next, choose Conversation or Reading; both use exactly the same group of words. AI runs only when explicitly starting or submitting an activity.
- Finish session is explicit. Reading must have a successfully generated passage; conversation must have a successfully answered learner reply. Generating a chat greeting or finishing flashcards alone does not complete a session. Word-use checkmarks guide practice but do not gate completion.
- Round completion is coverage, not mastery: show completed sessions, words practised, and sessions remaining. After completion offer another round, freshly selected from current schedules. No practice action changes review dates, ratings, planting, or growth.
- Round groups, completion, current step, flashcard position/direction/reveal, reading passage, conversation and reply draft are saved in this browser, separately per account and word set. Leaving or refreshing resumes that round. This is not cross-device synchronization. If storage fails, show a warning and retain in-memory progress.
- Every round step offers **Exit round**, which discards that word set’s saved round and returns to the practice overview without requiring activity completion. Starting again selects a fresh round. Navigating elsewhere still preserves the round for resuming.
- Without AI, optional flashcards still work; the round waits for reading/conversation availability before it can finish. Failed requests retain the session and can be retried without advancing it.

- The practice overview uses one compact guided-round panel with the attention count, session count, and Start session, followed by the garden as a topic picker. Topic and seed-bag practice show their word-set label and three activity cards: Flashcards, Reading, and Conversation. These modes use the selected set regardless of difficulty and do not require a guided round.

- Clicking a practice garden plot or opening Practice from a topic page opens that topic’s activity cards. Seed-bag practice is accessible from the seed bag.

- Starting or resuming a weak-word round hides the topic-practice garden. Exit round restores the overview and garden. Both illustrated plots and mobile topic links open that topic’s practice cards.

- The topic-practice garden hides the seed bag artwork, mobile seed-bag button, and bag panel when the bag is empty. A nonempty bag remains accessible there.

- Guided and standalone topic/seed-bag activities share the same activity-card and flashcard components. Reading and conversation have a dedicated card containing their header, content, and controls, and show target words before starting. In guided rounds, Change activity appears in the activity header; Finish session appears in the card footer once completion is available.

- After skipping or completing flashcards, the guided activity chooser offers the shared Conversation and Reading cards.

- Active rounds use a compact session heading, word progress, and Exit round button across the shared page width. The heading aligns with the page’s left edge, while flashcards remain centered at review width. The Practice overview heading returns on exit.

- AI practice activities use the available page width. Practice flashcards use the same centered 690px maximum width as review, shrinking to fit phones, with progress and navigation aligned to the card.

- The session introduction displays its up-to-five German words as compact, noninteractive labels in a wrapping row. Actions sit alongside on wide screens and wrap below on phones, without full-width word rows or separators.

- In both guided and standalone practice, Previous and Next sit below and outside the flashcard panel. The last card offers Continue to activity in guided rounds or Finish deck in standalone practice. Reveal, Hint, and Context stay inside the card.

- Practice flashcards show card progress in a review-style progress bar above the card. Standalone flashcards place the direction selector alongside that progress bar. The card contains vocabulary and its reveal, hint, and Context controls, without a duplicate direction badge.

- During guided flashcards, the direction selector sits in the session summary beside the session heading and word progress. Skip to activity sits alongside Exit round in that header; neither appears beside the flashcard progress bar.

## Design reference
- The garden gnome section also presents all six SVG characters: the Original, Foreman, Seed Thief, Squatter, Hexer, and Saboteur. Each has a distinct silhouette, face, hat, and pose or prop, with a shared-hat-color comparison control. The design patch uses the same weighted mix as the live garden. Shuffle gnomes changes only the demo cast.
- The design page includes an interactive garden gnome preview using the shared garden renderer and static demo vocabulary covering growth stages 0–5, production buds and flowers, and a separate Learned plant. Preview controls cover just due, 12 hours, days one through five, and seven days; an after-review preview clears the sample overdue state. No learner data is read or changed.
- `/design` is a public, URL-only design reference, with no app navigation link (hosted hash-router URL: `/#/design`). It renders outside the authenticated app shell, without login, session requests, or learner data.
- It documents the current palette, typography, spacing, controls, study cards, growth/status visuals, activity patterns, feedback, responsive layouts and usage rules. Shared components render live examples where possible; all demo interactions use sample data and local state without saving learning progress or requesting AI.
- Audit findings distinguish established choices from proposed follow-up improvements. The reference is not a separate visual theme or a change to learning rules.

## Shared color and typography
- Canvas, surfaces, navigation, body text, muted text, focus and action palettes use shared CSS tokens. Supporting copy, metadata and placeholders share one muted color. Garden actions use the same primary, secondary and hover colors as other pages.
- Page headings use 32px (28px on phones), dialog titles 24px, section/card headings 18px, and compact panel headings 16px. Body text uses 15px; secondary answer context and feedback use 14px; supporting labels and compact controls use 13px; captions use 12px. Standard controls use 15px. Reading/conversation text retains 17px for sustained reading.
- Study vocabulary retains its larger 38px size (30px at narrow phone widths), with example sentences at 18px (16px on narrow phones). Phone text inputs retain 16px. Numeric metrics and branding may use their own display sizes.
- Status chips retain pale semantic fills while charts use stronger versions. These differences express purpose rather than page-specific styling.
- The design reference inventories these shared styles and intentional variants using the same tokens and components as the app.

## Page navigation placement
- All page headings occupy the shared page container width and align to its left edge. Put narrower content wrappers below the heading, never around it; Garden dashboard cards use the full shared page width, aligned with the heading. Study cards retain their narrower width. The home garden illustration uses the available page width, with a responsive height capped at 660px.
- Use the shared Heading component for page titles, optional scope/context, return navigation, and page-level actions. The title/context is left aligned; return links and actions are grouped at the right of the same heading row. On narrow screens the group wraps below the title and remains right aligned, without horizontal overflow.
- Return links use underlined, muted 13px text with a left arrow and an explicit destination (for example, “← Practice” or “← All practice”). Do not place standalone return links above or below the page heading. Topic pages provide only the Explore topics return destination in this group.
- Reading, Conversation and Flashcards return to Practice with their current topic/seed-bag query preserved. Topic and seed-bag Practice provide “← All practice” to the unfiltered overview. Use explicit router destinations rather than browser history so direct links work predictably.
- Forward links that start a flow (such as a topic’s Practice and Review) retain button styling in the heading action group or their relevant content card. Ordinary inline links remain in context. Word-set switches are controls, not return links.
- Within a guided round, Exit round and Change activity remain buttons in the relevant session/activity header because they change local session state. Page navigation must not implicitly discard a saved round.

## Loading feedback
- Saved-session validation shares its result with the app shell and starts loading the garden concurrently. The garden response includes its hard-word count; the home screen does not fetch a full practice word list just for that count. Other page code loads when its route is opened.
- Shared loading feedback occupies a centered, padded region with a 72px-wide animated plant and visible body-sized “Loading…” underneath, giving missing panels a clear placeholder: its stem grows, leaves unfold, and a golden flower blooms before gently fading and repeating. It represents waiting, not learning progress or a growth-stage change. Keep loading scoped to the affected content.
- The SVG is hidden from assistive technology; a single status region announces the unchanged loading label. Reserve the illustration’s space to avoid movement during the animation. The visible label cycles through one, two, and three dots in a fixed-width space; screen readers receive a single static “Loading…” label. Reduced-motion preferences show the fully grown plant and all three dots without animation.

- Review places its DE → EN / EN → DE direction switch beside Plants / Seeds in the shared Heading actions. Both use the same compact segmented styling and count badges. Do not repeat the selected mode inside the card or add explanatory subtitles above progress. Progress sits immediately above the study card. Do not use eyebrow labels above headings.

- Articles is a separate main-navigation tab at `/articles` for fast article reviews, with its own heading and Plants / Seeds scope switch. Review contains only DE → EN and EN → DE; both still ask and save noun articles independently.

- Review defaults to EN → DE for planted words and places it before DE → EN, because Good/Easy production ratings also update recognition and can clear its due reviews. Seed bag review still starts with DE → EN while production is locked.

- Articles uses a compact, centered 480px card with a noun and three fixed der / die / das buttons. After saving, mark the correct choice with a check and a wrong selection with a cross. Articles advances automatically after every answer: 800ms for correct answers and 1400ms for mistakes so the correction can be read. Failed saves preserve the question; failed advances offer retry without rating again.

- Article feedback is confined to answer buttons: strong green/red fills with white text and check/cross marks. Keep cards neutral. Do not add visible Correct/Incorrect text, repeat the corrected noun below the buttons, or color card backgrounds and borders.

- Noun article checks inside Review share the Articles answer buttons and green/red button styling. Keep the marked choices visible after reveal in either direction. Use accessible labels instead of visible instruction headings or grading explanations.

- Article answer buttons sit below and outside the card in Review and Articles. Keep their green/red selected-answer feedback visible there after answering.

- In EN → DE review, choosing an article saves only the article result and leaves the English prompt visible. The learner explicitly selects Show answer before seeing the German answer and rating word recall, matching the separate reveal step in DE → EN.

- EN → DE review does not ask for an article choice or update the article schedule. Show the English prompt, then Show answer, then rate word recall. The revealed German answer includes the article. Good/Easy still updates recognition. Article guessing remains in DE → EN and the separate Articles mode. This supersedes the earlier EN → DE article-choice flow.

- After revealing a noun in EN → DE, Wrong article saves Good for production (including its usual recognition reinforcement) and Again for the article in one atomic write. The article becomes due in Articles after the normal Again delay of one minute. This button appears only for nouns with a canonical der/die/das article.

- Good or Easy in EN → DE also rates the noun article Good, even when its article schedule is not due. Wrong article overrides this with Again. Again/Hard production leaves article progress unchanged. Article-only due words appear only in Articles, not in DE → EN or EN → DE.

- The overview replaces Extra care with Finishing touches: show the count of currently due article schedules for planted, non-Learned nouns, including zero; show a dash while unavailable. When positive, offer Review N articles linking to `/articles`. Refresh with the garden summary every minute and after ratings. Hard-word practice remains available through Practice.

- Overview card titles use the same warm tone: A little tending, Fresh finds, and Finishing touches. Specific learning tasks belong in the count and action text.

- Overview cards appear in this order: A little tending, Finishing touches, Fresh finds. Article reviews occupy the middle; discovery and the seed bag sit on the right. Preserve this order when stacked on phones.

- Review Plants / Seeds badges count unique words due for recognition or production, excluding article-only reviews; these totals remain stable between vocabulary directions. Articles badges count only due article checks. Counts retain topic scope and are consistent before and after ratings.
