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
- The local Python version retains its on-device profile chooser.
- Used on a laptop, so desktop layout comes first.
- Not in scope: social features and adding your own vocabulary.

## Word states

| State | How a word gets there | Visible by default |
|---|---|---|
| In seed bank | Not seen yet (starting state of every word) | No |
| In seed bag | Marked "Keep" in the vocab matcher | Yes |
| Planted | The word received its first review rating | Yes, in the garden under each of its topics |
| Learned | Marked "Learned" in the vocab matcher (user already knows it). Counts as fully grown, permanently. | No, but viewable through a filter |
| Archived | Marked "Not now" in the vocab matcher (not relevant at the moment) | No, but viewable through a filter |

## Seed bag
- There is only ever one seed bag.
- It holds up to 20 words.
- Words in the seed bag can be practised and reviewed at any time.
- Reviewing a seed plants that word immediately, regardless of its rating, and removes it from the bag. Practice does not plant words.
- At 20 seeds, the bag is full. Review a seed to plant it and make room; there is no separate planting action.

## Growth
- Plants wilt when their words are due for review, appearing drooped and muted until reviewed. Wilting does not change growth stages; learned words never wilt.
- Seedlings and saplings are shown as young plants with slender green stems. Seedlings have a shorter stem and three leaves; saplings have four leaves.
- Only reviews change a word's growth stage, using spaced repetition.
- Practice never changes growth. Flashcards just show words one after another, with no grading.

## Home screen = the garden
- Two main actions are always visible: **Review** and **Find new words** (opens the vocab matcher).
- Each topic is shown as a card with:
  - a progress bar showing both how much of the topic's vocabulary is planted and how grown it is (learned words count as fully grown);
  - actions to practise and review that topic.
- Review is also available across all topics.
- Topics the user hasn't planted any words in yet are shown too. Opening one launches the vocab matcher for that topic.
- Time spent in the app is shown for today and as a running total.
- A 5-minute timer encourages users to stay at least 5 minutes, then disappears.
- Reference for the visual style: Memrise's course page before its redesign (a card per unit with a plant icon, a progress bar and one main button, and a word list with a growth bar per word).

## Empty garden (new users)
- New users land directly on the home screen; there is no separate onboarding flow.
- While the garden is empty, the only available action is to fill the first seed bag, which opens the vocab matcher.

## Vocab matcher
- **Guidance panel:** pick a topic (or let the app choose), and optionally describe in free text what kind of words you want, e.g. "words for a wine evening with friends". An LLM uses this to pick words from the seed bank.
- **Word card:** topic, the word with article, part of speech, CEFR level, an example sentence, and the English translation on tap.
- **Actions per card:** Not now, Learned, Keep.
- **Side panel:** the seed bag as a list of kept words, with actions to practise or review seeds.

## Practice and review
- Both work on either the seed bag or one topic.
- Practising a topic includes all of its words that aren't fully grown.
- Each word's growth stage is shown during practice.
- Review format: flip the card, then self-grade how well you knew it. That grade updates the word's growth stage.
- Review ends when no new or currently due words remain in the selected set. Future reviews are not shown early.
- In review and practice flashcards, noun articles are hidden in the word heading until the card is flipped.
