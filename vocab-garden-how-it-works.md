# How German Garden works

German Garden helps learners discover useful German words, practise them, and review them over time. Each account has its own vocabulary progress and review schedules. This guide explains the learning flows and rules; [UX and design decisions](vocab-garden-ux.md) covers their presentation and interaction details.

## The learning cycle

1. Discover words in the **seed bank**, through Find words or topic lists.
2. Keep useful words in the **seed bag**.
3. Practise them with flashcards, Context, reading, or conversation.
4. Review a seed to plant it in the **garden**.
5. Return when reviews are due. Ratings determine the next review date and growth.
6. Once both review directions mature, choose **Mark as Learned** to stop reviews permanently, or keep reviewing.

Practice is optional before a review. Practice never plants words or changes review dates or growth.

## Word states

| State | Meaning | What happens next |
|---|---|---|
| Seed bank | An unseen word | Keep it, mark it Learned, or choose Not now |
| Seed bag | A kept word awaiting its first review | Practise it or review it to plant it |
| Planted | A word that has received a review rating | Practise it and review it when due |
| Learned | A permanently completed word | It remains available for practice, with no reviews or wilting |
| Not now | A word set aside during discovery | Revisit it through a topic list and add it to the seed bag |

There is one seed bag per account, with a maximum of **20 words**. Every first review rating plants that seed and frees its place in the bag, including Again. Adding the same word twice does not create duplicates or reset its progress.

A word can belong to several topics. Its learning progress is shared across those topics.

## Discovery and levels

Find words selects unseen vocabulary. The learner can choose a topic or let the app select one. A free-text request can use AI guidance when no specific topic is selected; ordinary discovery does not require AI.

Each discovery decision has a distinct effect:

- **Keep** adds the word to the seed bag.
- **Learned** permanently completes a word the learner already knows.
- **Not now** sets the word aside without learning or planting it.

Vocabulary covers A1, A2, and B1. Topic lists normally show the learner’s level, plus their kept, planted, and Learned words from other levels. Show other levels also includes unseen and Not now words at other levels.

Discovery adapts its sampling through below-level and above-level affinities. The declared level changes only through an explicit learner action. Changing it resets those affinities and preserves vocabulary progress.

After an A1 or A2 learner has explored every word at their current level, the garden offers advancement to the next level. “Explored” includes Keep, Learned, and Not now decisions; it does not mean every word has been mastered. New accounts choose a level during setup; Not sure starts at A1.

## Two review directions

Each planted word has separate schedules for:

- **Recognition, German → English:** starts with the first review.
- **Production, English → German:** unlocks permanently when recognition reaches a seven-day interval.

Production starts with a fresh interval and repetition count, but inherits recognition’s ease after the unlocking rating. It is immediately due for the next review session.

When production is due, it takes priority over recognition. A Good or Easy production rating also applies that rating to recognition, even if recognition is not due. Again and Hard production ratings affect production only.

## Ratings and scheduling

The learner reveals the answer and self-grades. Nouns with a known article require an article choice before reveal; that choice does not save a rating automatically.

Each track has an **ease multiplier**, initially 2.5 for recognition. Higher ease makes successful established reviews spread further apart. Ease never falls below 1.3.

| Rating | New or relearning track | Established track, including mature tracks |
|---|---|---|
| Again | Due in 1 minute; ease decreases by 0.20 | Due in 1 minute; ease decreases by 0.20; returns to relearning |
| Hard | Due in 10 minutes; ease unchanged | Next interval is min(previous interval × 1.2, 1 day); ease decreases by 0.15 |
| Good | Due in 1 day; ease unchanged; enters established review | Ease increases by 0.05; next interval is previous interval × updated ease, minimum 1 day |
| Easy | Due in 4 days; ease unchanged; enters established review | Ease increases by 0.20; next interval is previous interval × updated ease × 1.3, minimum 1 day |

Intervals run from the time the rating is submitted. Again resets the track’s repetition count and records a lapse. Hard keeps new or relearning tracks in their current learning state.

## Review sessions

A review session covers one visit to Review for one selected word set: the garden, a topic, or the seed bag. It includes new seeds or currently due planted words, never future reviews early.

Each word appears **at most once per session**, across both directions. A one-minute Again retry therefore requires a new session. The session ends when no unseen-in-this-session eligible words remain, even if a rated word or its other track is still due.

Refreshing resumes the session in the same browser tab and account. Leaving Review or switching word sets starts a new session.

## Growth and permanent completion

Recognition drives early growth. A seven-day interval unlocks production; a 21-day recognition interval reaches the next growth stage. Each track matures when it reaches a **55-day interval**. Both tracks must be mature for the plant to be fully grown.

Mature tracks remain scheduled until the learner chooses Mark as Learned. Their mature status survives a Hard rating; Again returns the rated track to learning or relearning. Production stays unlocked even after a lapse.

After a rating leaves both tracks mature, Review offers Mark as Learned or Keep reviewing. Learned words stay fully grown permanently and never wilt.

For a new word rated Good every time, the current scheduler offers Mark as Learned after **nine reviews**: four recognition reviews followed by five production reviews. Production’s fifth Good reaches approximately 59.25 days, passing the 55-day threshold. This is an interval threshold, not a requirement to wait 55 calendar days after first seeing the word.

## Practice

Practice is available for topic words, seeds, and words needing extra attention. Topic practice includes planted and Learned words. Unseen and Not now words must first be added to the seed bag.

| Activity | Purpose |
|---|---|
| Flashcards | Rehearse either direction without grading |
| Context | Read a short English meaning/usage explanation and ask questions in a private saved chat |
| Reading | Generate a passage using the selected vocabulary |
| Conversation | Practise the selected vocabulary in a conversation |

AI is used only when requested for examples, feedback, reading, or conversation. Flashcards work without AI. None of these activities changes review schedules, growth, or Learned status.

### Guided rounds for words needing attention

The main practice flow selects planted, non-Learned words with an Again or Hard latest rating on either track, or an interval shorter than one day. A newly unlocked, unrated production track does not qualify by itself. Words are ordered Again first, then Hard, then other short-interval words, with shorter intervals and word IDs breaking ties.

Starting a round fixes that list into groups of up to five words. Each session introduces its group, offers optional flashcards, then reading or conversation with the same words. New difficult words join the next round.

Finish session becomes available after a generated reading passage or a successfully answered learner reply in conversation. A chat greeting or flashcards alone do not complete it. Completion measures practice coverage, not mastery.

Round progress is saved in the browser per account and word set. Leaving or refreshing resumes it. Exit round discards that saved round; starting again selects a fresh list. Without AI, flashcards remain available, but completing the round waits for reading or conversation.

## Due counts and overdue words

The garden counts a planted word once when either track is due. Seeds and Learned words are excluded. “More due today” counts additional words scheduled before the end of the learner’s local day.

Upcoming reviews place each word on its earliest scheduled track date. These are snapshots of existing schedules; they do not predict later ratings, repeat reviews, or production unlocks.

Due plants wilt without losing growth merely because time passes. Gnomes indicate the oldest overdue track in each topic: one after 12 hours, then two at one day, increasing to a maximum of six at five days. They have no effect on learning rules. Reviewing removes them only as the remaining overdue schedules improve; practice does not remove them.

## Accounts and saved progress

Accounts are created by the garden owner. Vocabulary decisions, review schedules, and Learned status are saved per account and shared across devices. Review-session exclusions stay in the current browser tab; guided practice rounds stay in the current browser.

Signing out ends the current browser session without signing out other devices. The app does not track time spent learning. Imports preserve source data and must not silently replace existing cloud progress.