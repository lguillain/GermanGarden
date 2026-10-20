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
| **Practice** | Flashcards, chat, reading or the grammar playground. Never changes growth stages. |
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
- On phones, Find words starts with collapsed topic selection and seed bag panels, review ratings use a two-by-two grid, grammar's scrollable word picker sits above the exercise, and topic word tables become stacked rows while retaining sorting.
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
- The home screen is an illustrated garden. Topics containing planted or learned words appear as plots; selecting a plot opens its topic page.
- **Find new words** opens the vocab matcher. **Review words** reviews planted words across all topics and shows a due count when there are reviews due. Once home data loads, this action is hidden if there are no planted words.
- Selecting the seed bag in the garden opens its word list, with **Practice** and **Plant** actions when it contains seeds. **Plant** starts a seed-bag review; it does not plant words without ratings.
- The sidebar provides Garden, Explore topics, Find words, Practice, and Review navigation.
- The home summary shows words planted, reviews due, time today, and total time. The planted count counts reviewed words, while plots also include words marked Learned.
- There is currently no visible 5-minute countdown.

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
- **Word card:** topic, the word with article, part of speech, CEFR level, an example sentence, and the English translation on tap.
- Returning to Find words keeps the current card when its cached state is still valid. Reconnecting must not replace it. If progress changed elsewhere in the app and the selection needs refreshing, show a loading state until the fresh card is ready rather than flashing an outdated card first.
- The next card is preloaded for each possible choice and shown while that choice saves. A saving indicator remains visible and further choices stay disabled until confirmation. Failed saves restore the previous card; concurrent changes use the server’s fresh selection. The seed bag shows confirmed progress only.
- **Actions per card:** Not now, Learned, Keep.
- **Side panel:** the seed bag as a list of kept words, with actions to practise or review seeds.

## Practice and review
- The practice menu, Reading, and Conversation load only word counts before starting. Grammar loads its word list and form options; generated exercises fetch their own target words.
- Both support planted words across the whole garden, planted words in one topic, or the seed bag. The **Plants / Seeds** switch keeps seeds separate from planted words and preserves the selected topic when switching back to plants.
- Topic practice includes its planted and Learned words, including words marked Learned directly in the matcher. Unseen and Not now words must first be added to the seed bag to practise them.
- Practice flashcards show each word's growth stage; AI practice shows its target vocabulary.
- Review format: flip the card, then self-grade how well you knew it. That grade updates the word's growth stage.
- Review mixes both directions and labels every card. Each word appears at most once per session; production takes priority when both tracks are due. Good or Easy production also applies the same rating to recognition, even if recognition is not due. Hard and Again production affect production only.
- A session covers one visit to Review for one selected word set. Refresh resumes the session; leaving Review or switching sets starts a new session. Session progress is local to the browser tab and account.
- Review ends when no unseen-in-this-session new or currently due words remain. Future reviews are not shown early. A completed session can leave due words in the garden.
- Review remains flip-and-self-grade. In review and practice, production prompts show the English meaning, part of speech and English example sentence when available. A **Hint** button reveals the first German letter only when requested; hints reset for each card and when switching direction. German examples, plurals and the answer stay hidden until reveal. Noun answers include the article.
- Immediately after a rating makes both tracks mature, Review offers **Mark as Learned** or **Keep reviewing**. Learned permanently completes both tracks, stops review and wilting, and remains available for practice. The choice is also offered after later mature ratings.
- Practice flashcards have a DE → EN / EN → DE toggle for both plants and seeds, including words whose production review is locked. Switching direction hides the answer again; practice never changes schedules or growth.
- In review and practice flashcards, noun articles are hidden in the word heading until the card is flipped.
