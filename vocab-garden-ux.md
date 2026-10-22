# Vocab Garden: UX decisions

A German vocabulary web app. Users discover words they care about, practise them, and watch them grow in a "garden" as they remember them better over time.

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
| **Practice** | Flashcards (including Forms), chat, or reading. Never changes growth stages. |
| **Review** | A short knowledge check on a set of words. The only thing that changes growth stages. |

## Users and context
- Two users for now (the author and her husband), possibly more later.
- The hosted app uses private email/password accounts created by the garden owner. Each account has its own progress, shared across devices; there is no public signup.
- Imported accounts can sign in using their profile username (for example, `leo`) and password. Full email addresses are also accepted.
- Sign-in submits the current field values, including browser/password-manager autofill.
- Clicking the farmer icon signs out the current browser session and returns to sign-in. Other devices stay signed in, and the learner can immediately sign in again or switch accounts.
- The local Python version retains its on-device profile chooser.
- The signed-in sidebar appears from browser login state while profile and page data load. Session bootstrap reads only the learner name, level, and AI availability, never vocabulary or learning progress. Topic names load separately when needed. Signed-in pages mount alongside session bootstrap. Headings, navigation, search/filter inputs, and practice-mode links stay available while independent data loads; loading/error messages are scoped to the affected content. AI actions wait for confirmed availability. Card decisions and review ratings remain disabled during saves to avoid conflicting writes. Server requests still verify authentication.
- Supports laptops and phones. At phone widths (760px and below), navigation becomes a compact header with an expandable menu, and study flows use the full screen width. Opening another page closes the menu.
- On phones, Find words starts with collapsed topic selection and seed bag panels, review ratings use a two-by-two grid, Forms opens as a full-width popup, and topic word tables become stacked rows while retaining sorting.
- The phone garden includes visible topic links and a labelled seed-bag button alongside the illustration, so navigation does not require hovering or selecting small artwork targets.
- Not in scope: social features and adding your own vocabulary.

## Word states

| State | How a word gets there | Visible by default |
|---|---|---|
| In seed bank | Not seen yet (starting state of every word) | In topic word lists, but not as garden plants |
| In seed bag | Marked "Keep" in the vocab matcher or added from a topic word list | Yes |
| Planted | The word received its first review rating | Yes, in the garden under each of its topics |
| Learned | Marked "Learned" in the vocab matcher (user already knows it). Counts as fully grown, permanently. | Yes, in garden plots and topic word lists |
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
- Recognition drives early growth. Each track matures at a 60-day interval; a plant is fully grown only when both tracks are mature. Naturally mature words remain scheduled and may wilt.
- Production unlocking adds a closed flower bud; production progress gradually opens it. The flower opens fully only when both tracks are mature. Lapses can close the flower again without relocking production.
- Plants wilt when either track is due, appearing drooped and muted. Wilting itself does not change growth stages; Learned words never wilt.
- Existing schedules become recognition schedules. Existing saplings and later stages unlock fresh production schedules; existing Learned words remain permanently complete.
- Seedlings and saplings are shown as young plants with slender green stems. Seedlings have a shorter stem and three leaves; saplings have four leaves.
- Only reviews change a word's growth stage, using spaced repetition.
- Practice never changes growth. Flashcards just show words one after another, with no grading.

## Home screen = the garden
- Dashboard actions use dark green when actionable: **Practice hard words** when hard words exist, and **Find new words** when Words found today is zero. Find new words returns to the secondary style once a word has been added that day.
- A fourth dashboard card shows the current hard-word count and offers **Practice hard words** only when that count is positive, opening the practice overview to start or resume a weak-word round. Zero words means no sessions and no button. Loading counts show a dash. The count uses the same current weak-word selection as practice and refreshes every minute.
- The home screen is an illustrated garden. Topics containing planted or learned words appear as plots; selecting a plot opens its topic page.
- **Find new words** opens the vocab matcher. **Review words** reviews planted words across all topics and appears as a button only when reviews are currently due, with the due count. Otherwise its position shows “Words due” and 0; while counts are unavailable it shows a dash.
- Selecting the seed bag in the garden opens its word list, with **Practice** and **Plant** actions when it contains seeds. **Plant** starts a seed-bag review; it does not plant words without ratings.
- The sidebar provides Garden, Explore topics, Find words, Practice, and Review navigation.
- Above the garden, separate summary cards show total words planted at the far left, reviews in the middle, and words found today with Find new words on the right. The review card contains due-today counts, the Review words button only when currently due (otherwise Words due 0), and Upcoming. Counts and buttons sit side by side within each card, forming one compact desktop row. Cards stack on small screens. The planted count counts reviewed words, while plots also include words marked Learned.
- Reviews due today includes overdue planted words and planted words scheduled before the end of the learner’s local calendar day, using the browser’s time zone. Each word counts once when either recognition or production is due; seeds and Learned words are excluded. This is a snapshot of current schedules, not a prediction of repeat reviews after ratings. Counts refresh every minute while the page is visible and after learning changes. Reviews remain available only when currently due.
- **Upcoming** is a compact calendar icon inside the review summary card, with an accessible label and an Upcoming reviews tooltip. It opens a modal with the due-now count and a horizontal bar chart of future counts grouped by local calendar date. Each bar has a visible date and word count, with lengths scaled to the busiest scheduled day. Each planted word appears once, on the earliest of its recognition and unlocked production schedules. Already-due words appear only in the due-now count; seeds and Learned words are excluded. All scheduled future dates are shown, including later today. These are current schedules, not predictions of repeat reviews or future production unlocks. The modal supports Close, Escape, and backdrop dismissal.
- The app does not track time spent learning or store activity-timer sessions.

## Explore topics and topic pages
- Explore topics lists all topics, including empty ones, and supports searching by topic name. Selecting a topic opens its topic page.
- Topic progress is shown for the learner's CEFR level, split into Unseen / Not now, Seeds, Planted, Review due, and Grown / Learned.
- Each topic page has a garden scene containing its planted and learned words, a progress summary, and a word list.
- Topic practice and review actions become available when the topic has planted words.
- The word list supports German/English search, status filters, and sorting by word, meaning, level, or status.
- By default, the list shows all statuses at the learner's level, plus seed-bag, planted, and learned words from other levels. **Show other levels** includes unseen and Not now words from other levels too.
- Words outside the seed bag and planted set have an **Add to bag** action, subject to the 20-word limit. This allows revisiting Not now words. Learned words are permanently complete and cannot return to the seed bag.
- Due words have a **Review** link that opens the topic's review set.

## Empty garden (new users)
- Accounts without a level first choose A1, A2, B1, or Not sure (starts with A1). They can optionally describe learning goals when AI is available.
- After setup, users land on the garden. Accounts with a level already configured skip setup.
- With no planted words, **Find new words** is the primary home action. Sidebar navigation remains available, and seeds can be practised or reviewed through the seed bag.
- A garden with no plots prompts the learner to review a seed to start growing.

## Vocab matcher
- **Guidance panel:** pick a topic (or let the app choose), and optionally describe in free text what kind of words you want, e.g. "words for a wine evening with friends". An LLM uses this to pick words from the seed bank.
- Opening Find words, choosing a topic, and moving between cards use the normal vocabulary selection rules immediately. They do not wait for automatic AI recommendations. AI guidance runs only when the learner submits a free-text request without choosing a specific topic.
- **Word card:** uses the same typography, spacing, reveal layout, and footer as review and practice. The selected topic is not repeated on the card. Discovery actions sit below the card.
- Returning to Find words keeps the current card when its cached state is still valid. Reconnecting must not replace it. If progress changed elsewhere in the app and the selection needs refreshing, show a loading state until the fresh card is ready rather than flashing an outdated card first.
- The next card is preloaded for each possible choice and shown while that choice saves. A saving indicator remains visible and further choices stay disabled until confirmation. Failed saves restore the previous card; concurrent changes use the server’s fresh selection. The seed bag shows confirmed progress only.
- **Actions per card:** Not now, Learned, Keep.
- **Side panel:** the seed bag as a list of kept words, with actions to practise or review seeds.

## Practice and review
- The practice menu, Reading, and Conversation load only word counts before starting. Forms loads its code and form options only when opened from a card; exercises use only that card’s word.
- Both support planted words across the whole garden, planted words in one topic, or the seed bag. The **Plants / Seeds** switch keeps seeds separate from planted words and preserves the selected topic when switching back to plants.
- Topic practice includes its planted and Learned words, including words marked Learned directly in the matcher. Unseen and Not now words must first be added to the seed bag to practise them.
- Practice flashcards and review cards show each word's growth with the garden’s plant icon inside the card header, without a visible growth-stage or production-progress label. The icon retains an accessible description. AI practice shows its target vocabulary.
- Review format: flip the card, then self-grade how well you knew it. That grade updates the word's growth stage.
- Review mixes both directions and labels every card. Each word appears at most once per session; production takes priority when both tracks are due. Good or Easy production also applies the same rating to recognition, even if recognition is not due. Hard and Again production affect production only.
- A session covers one visit to Review for one selected word set. Refresh resumes the session; leaving Review or switching sets starts a new session. Session progress is local to the browser tab and account.
- Review ends when no unseen-in-this-session new or currently due words remain. Future reviews are not shown early. A completed session can leave due words in the garden.
- Review remains flip-and-self-grade. In review and practice, production prompts show the English meaning, part of speech and English example sentence when available. A **Hint** button reveals the first German letter followed by one spaced underscore for each remaining letter (for example, `B _ _ _`), without a “Hint:” prefix; spaces and punctuation are preserved; hints reset for each card and when switching direction. German examples, plurals and the answer stay hidden until reveal. Noun answers include the article.
- Immediately after a rating makes both tracks mature, Review offers **Mark as Learned** or **Keep reviewing**. Learned permanently completes both tracks, stops review and wilting, and remains available for practice. The choice is also offered after later mature ratings.
- Practice flashcards have a DE → EN / EN → DE toggle for both plants and seeds, including words whose production review is locked. Switching direction hides the answer again; practice never changes schedules or growth.
- In review and practice flashcards, noun articles are hidden in the word heading until the card is flipped.
- Review and practice share the same word card and hide noun plurals until reveal in both directions.

- The grammar playground is part of the **Forms** popup, not a separate practice mode. Practice flashcards offer Forms at any time; Review offers it only after reveal, in either direction. Existing grammar links redirect to flashcards with the selected word set preserved.
- Forms opens a side popup for the current word, with the existing part-of-speech form selectors, Generate example, and sentence feedback. There is no word picker and no separately generated reference table. Examples and feedback use AI only when requested; opening the popup does not call AI.
- Closing Forms (Close, Escape, or backdrop) returns focus to its button and preserves the card, direction, hint, reveal state, and review progress. Popup drafts and results survive reopening on the same card; changing words starts a fresh workspace. Forms never rates, plants, or changes schedules or growth. Learned words remain usable for this practice.

- Practice and review cards group level/part of speech and direction in a compact header. The word and example remain central; reveal and Forms share a footer, with Forms styled as a secondary tool.

- Revealing an EN → DE card promotes the German answer (with its article) to the main heading, followed by its plural and German example. The English meaning and example move to a subdued context block below. This applies to practice and review.

- Revealed DE → EN cards use the same answer layout as revealed EN → DE cards: German word, plural, and example first, with English meaning and example in the subdued context block below.

- Find new words sits in its own summary card alongside Words found today. This counts distinct words first added to the seed bag on the learner’s local calendar day, from either discovery or topic additions. Words still count after planting or becoming Learned. Skipped words and words marked Learned without being kept do not count. Counts refresh with the garden summary; repeated keeps never count a word twice.


## Guided practice rounds
- Practice defaults to words needing attention: planted, non-Learned words whose recognition or rated production track has a latest rating of Again/Hard, or a scheduled interval strictly shorter than one day. This is the interval, not time remaining until due. Newly unlocked, unrated production tracks do not qualify on their own. A word counts once across tracks; old ratings do not qualify a word after its current schedules improve.
- Sort Again before Hard before other short-interval words, then shorter intervals and word ID. Weak-word sessions span the garden. Topic practice is a separate flow and does not filter by difficulty. Seed-bag practice remains a separate choice.
- The practice overview states how many words need attention and how many sessions cover them once (ceiling of word count / 5). Starting a round snapshots that ordered list into stable groups of up to five; the final group can be smaller. New weak words join the next round.
- Each session initially lists only its German words, including noun articles, without translations, difficulty reasons, or direction labels. It then offers optional flashcards or Skip to activity. Flashcards support both directions and Forms. Next, choose Conversation or Reading; both use exactly the same group of words. AI runs only when explicitly starting or submitting an activity.
- Finish session is explicit. Reading must have a successfully generated passage; conversation must have a successfully answered learner reply. Generating a chat greeting or finishing flashcards alone does not complete a session. Word-use checkmarks guide practice but do not gate completion.
- Round completion is coverage, not mastery: show completed sessions, words practised, and sessions remaining. After completion offer another round, freshly selected from current schedules. No practice action changes review dates, ratings, planting, or growth.
- Round groups, completion, current step, flashcard position/direction/reveal, reading passage, conversation and reply draft are saved in this browser, separately per account and word set. Leaving or refreshing resumes that round. This is not cross-device synchronization. If storage fails, show a warning and retain in-memory progress.
- Every round step offers **Exit round**, which discards that word set’s saved round and returns to the practice overview without requiring activity completion. Starting again selects a fresh round. Navigating elsewhere still preserves the round for resuming.
- Without AI, optional flashcards still work; the round waits for reading/conversation availability before it can finish. Failed requests retain the session and can be retried without advancing it.

- The practice overview uses one compact guided-round panel with the attention count, session count, and Start session. Within topic and seed-bag practice, a row of three cards with short descriptions offers Flashcards, Reading, and Conversation; these modes do not require a guided round or words needing attention. It omits the explanatory rules paragraph and separate Other practice card. The overview has no Plants / Seeds switch; seed practice remains accessible from the seed bag, and scoped pages retain their word-set label.

- Practice has two distinct entry points: garden-wide weak-word sessions and Topic practice. The main overview shows the weak-word panel and the garden as a topic picker. Clicking a garden topic plot, or opening Practice from a topic page, shows only that topic’s Flashcards, Reading, and Conversation cards, with no weak-word round panel. General practice uses the topic’s planted and Learned words regardless of difficulty. Seed-bag practice retains its own three modes.

- Starting or resuming a weak-word round hides the topic-practice garden. Exit round restores the overview and garden. Both illustrated plots and mobile topic links open that topic’s practice cards.

- The topic-practice garden hides the seed bag artwork, mobile seed-bag button, and bag panel when the bag is empty. A nonempty bag remains accessible there.

- Garden dashboard cards share a compact layout: label and count on the left, actions on the right, consistent padding and button sizing. Four cards fit on wide screens, two per row on narrower desktops, and one per row on phones. Button labels remain on one line.

- Guided and standalone topic/seed-bag activities share the same activity-card and flashcard components. Reading and conversation have a dedicated card containing their header, content, and controls. Flashcards put progress, the compact direction selector, and secondary Skip to activity or Change activity actions above the word card. Reading and conversation show target words before starting. Finish session appears in a separate card footer only once completion is available.

- After skipping or completing flashcards, the guided activity chooser offers only the shared Conversation and Reading cards. Topic/seed-bag practice still offers all three modes. It has no separate instructional panel or Back to flashcards button.

- Active rounds replace the large Practice page heading and boxed session summary with a compact session heading, word progress, and Exit round link aligned to the activity card. The overview heading returns on exit.

- AI practice activities use the available page width. Practice flashcards use the same centered 690px maximum width as review, shrinking to fit phones, with progress and navigation aligned to the card.

- The session introduction displays its up-to-five German words as compact, noninteractive labels in a wrapping row. Actions sit alongside on wide screens and wrap below on phones, without full-width word rows or separators.

- On DE → EN cards in review and practice, the German example sentence is hidden until the learner requests Hint or reveals the answer. The hint reveals only that sentence, not the plural or translation, and resets when the word or direction changes.

- Shared study cards reserve space for both prompt and revealed answer using overlapping layout faces. Concealed content is invisible and excluded from accessibility; hints and reveal keep the card and footer height stable, including wrapped sentences on phones.

- In both review directions, nouns with a known der/die/das article require an article choice before reveal. The card labels the choices “Choose the correct article.” Either choice reveals the answer with the correct article in the heading, without additional feedback text. No rating is saved automatically; the learner then chooses Again, Hard, Good, or Easy normally. Hints are unavailable before the choice so examples cannot reveal the article. Practice remains ungraded; nouns without a canonical article use normal reveal.

- Noun article choices appear directly beneath the heading inside the review card, close to the missing-article blank. The normal rating buttons appear below the card only after an article choice.
- Before the article choice, DE → EN noun review headings show a blank before the noun (for example, “___ Baum”); reveal replaces it with the correct article. EN → DE keeps the English prompt to avoid giving away the German word.

- In both guided and standalone practice, Previous and Next (or Continue to activity) sit below and outside the flashcard panel. Reveal, Hint, and Forms stay inside the card.

- Practice flashcards show card progress in the review-style progress bar above the card, alongside the direction selector and activity navigation. The card contains only vocabulary and its reveal, hint, and Forms controls; no duplicate direction badge. This applies to guided and standalone practice.

- During guided flashcards, the direction selector sits in the session summary beside the session heading and word progress. Skip to activity sits alongside Exit round in that header; neither appears beside the flashcard progress bar.

- The guided session heading and word progress align with the page’s left edge, like the Review heading. The session header spans the page, while the flashcard and its card progress/navigation remain centered at review width.
