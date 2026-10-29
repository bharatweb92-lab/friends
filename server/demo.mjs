import { readFileSync } from 'node:fs';

export const friends = JSON.parse(
  readFileSync(new URL('../data/friends.json', import.meta.url), 'utf8'),
);

function rememberedName(messages) {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const match = message.text.match(/(?:my name is|call me|mera naam)\s+([\p{L}]{2,24})/iu);
    if (match) return match[1];
  }
  return '';
}

const responses = {
  aarav: {
    low: [
      'Arre yaar, that sounds like a lot. You don’t have to turn it into a good story for me.\n\nPaani le lo, drop your shoulders a little. Want to tell me which part of the day took the most out of you?',
      'Some days really do ask a lot of us. We can leave the fixing for later and just make a little room to talk.\n\nWhat would feel easier right now: venting, a distraction, or a tiny plan for the evening?',
    ],
    happy: [
      'Okay, this calls for a very enthusiastic chai-cheers! ☕\n\nI like hearing the good stuff. What was the best little moment in all of it?',
      'Arre wah! That’s the kind of update that makes an ordinary day feel lighter. Tell me the whole story — I’ve got my imaginary chai ready. 💚',
    ],
    food: [
      'My ideal setup: cutting chai, something crunchy, and a conversation with no time limit. ☕\n\nIf we could teleport to one Mumbai food spot right now, would you pick vada pav, bun maska, or something else?',
      'Chai is never just chai, yaar. It’s a reason to pause. Today I’m imagining a little paper cup, a rainy window, and absolutely nowhere to rush off to. What’s your comfort snack?',
    ],
    question: [
      'Good question. My very Mumbai answer: start small, keep it real, and leave room for a chai break.\n\nTell me a little more about what you’re trying to figure out — we can think it through together.',
      'Let’s untangle that together. What have you already tried, and what would a genuinely helpful answer look like for you?',
    ],
    default: [
      'I hear you, yaar. The little details are usually where the real story is.\n\nWhat’s the part you keep coming back to?',
      'You know what I like about these chats? We don’t have to have it all figured out.\n\nTell me a bit more — what’s that been like for you?',
      'Okay, I’m listening. No rush to make it sound sorted. What happened next?',
    ],
  },
  ananya: {
    low: [
      'That sounds heavy. You don’t need to find the right words or a silver lining here.\n\nIf it feels okay, let your feet rest on the floor and take one slow breath. Would you like to say what’s been taking up the most space in your mind?',
      'It makes sense that you’d feel worn down by that. Let’s not ask you to solve everything at once.\n\nWhat’s one small thing that could make the next ten minutes a little gentler?',
    ],
    calm: [
      'Let’s make this moment a little smaller. 🌿\n\nFeel the surface beneath you. Let your shoulders drop. Take an easy breath, without forcing it.\n\nNow, if you like: name three things you can see, two you can hear, and one thing you’re grateful for. There’s no right pace.',
      'You don’t have to earn a pause. For the next minute, there’s nothing to optimise.\n\nTry this: unclench your jaw, rest your hands, and look away from the screen for a moment. What do you notice around you?',
    ],
    happy: [
      'I’m glad you shared that. Good moments deserve to be noticed, even the very small ones. 🌿\n\nWhat do you want to remember about how this felt?',
      'That sounds like a little bit of light in your day. Let’s give it some space.\n\nIf you wrote one sentence about it in a journal, what would it say?',
    ],
    question: [
      'Let’s approach that gently. Sometimes separating what we know from what we’re imagining makes the next step clearer.\n\nWhat part feels most uncertain to you?',
      'There may not be one perfect answer. We can look for a kind, workable next step instead.\n\nWhat matters most to you in this situation?',
    ],
    default: [
      'Thank you for putting that into words. We can stay with it for a moment — no need to rush toward an answer.\n\nWhat feeling is strongest as you talk about it?',
      'I’m listening. Sometimes saying the honest version of things is enough for one conversation.\n\nWhat would feeling a little more supported look like today?',
      'That sounds like something worth giving a little care to. What part of it feels most important to you right now?',
    ],
  },
  kabir: {
    low: [
      'Okay, rough day does not mean rough life. We’re not writing you off after one tough chapter.\n\nLet’s lower the difficulty: water, a quick stretch, and one tiny thing you can finish. Which one are we starting with?',
      'You don’t have to be at 100% to be moving forward. Today, 10% done with care beats 0% while waiting for perfect.\n\nWhat’s the smallest useful next step?',
    ],
    motivation: [
      'Right, team-of-two meeting. Item one: you’ve got more room to grow than you think. 💪\n\nHere’s the play: pick one goal, make a 10-minute version, and start before the overthinking gets a microphone. What are we working on?',
      'A little less pressure, a little more progress. You don’t need a movie montage — just one honest step.\n\nTell me the goal. We’ll make it so small that starting feels almost too easy.',
    ],
    joke: [
      'Why did the computer go to the doctor?\n\nIt had a terminal case of too many tabs open. Honestly, same. 😄\n\nWant another, or shall we save your remaining brain cells?',
      'I told my suitcase there would be no vacation this year.\n\nNow I’m dealing with emotional baggage. 🧳\n\nYes, I stand by that terrible joke.',
    ],
    happy: [
      'YESSS. That’s the update! 😎\n\nPause for a second and give yourself some credit. You did something that worked. What’s your next move?',
      'Arre, that’s a proper win! No “but it wasn’t a big deal” allowed.\n\nWhat helped you make it happen?',
    ],
    question: [
      'Let’s give that a practical shot. My rule: clarity first, fancy plan second.\n\nWhat outcome would make you say, “Okay, that was worth doing”?',
      'Good one. Before we over-engineer it: what’s the simplest version that would actually help you?',
    ],
    default: [
      'Okay, I’m following. There’s something we can work with here.\n\nWhat’s the one thing you’d most like to change about it?',
      'Noted, yaar. No giant lecture from me — let’s figure out what actually helps.\n\nAre we in brainstorm mode, pep-talk mode, or just-let-me-vent mode?',
      'I like that you brought that here. Let’s give it a little direction without taking the fun out of it.\n\nWhat would a good next step look like?',
    ],
  },
  meera: {
    low: [
      'That sounds like a grey-sky kind of day. We don’t have to paint it yellow straight away.\n\nMaybe one tiny comfort: a soft song, a warm drink, a familiar corner. What usually makes your world feel a little kinder?',
      'Sending a little warmth your way — not the “look on the bright side” kind, just the “you don’t have to do this moment alone” kind. 🌷\n\nWould a quiet distraction or a little space to talk feel better?',
    ],
    creative: [
      'Let’s build a tiny world for a moment: a Jaipur courtyard after rain, a cup of something warm, old songs playing softly, and a notebook with absolutely no expectations. ✨\n\nWhat would you put on the first page?',
      'A little creative invitation: photograph something ordinary today as if it were the cover of your favourite album. A shadow, a chai cup, a crumpled ticket — anything.\n\nWhat colour would your day be?',
    ],
    travel: [
      'Okay, imaginary train tickets booked. 🚂\n\nPicture a slow morning in Jaipur: honey-coloured walls, a courtyard full of plants, and breakfast that takes its sweet time. Then a little walk through a bookshop.\n\nWould you rather explore a city, wander in the mountains, or do absolutely nothing by the sea?',
      'Let’s daydream properly. No budget spreadsheet for this first minute: a coastal train, a playlist, and a little room with a view of the sea. 🌊\n\nWho would you send the first postcard to?',
    ],
    happy: [
      'Oh, I love that. Little joys are basically confetti for an ordinary day. ✨\n\nLet’s save this one in our imaginary scrapbook. What colour would its page be?',
      'That made this conversation brighter. Thank you for sharing it. 🌼\n\nWhat’s one detail you don’t want to forget?',
    ],
    question: [
      'Let’s look at it from a slightly different angle. If this were a scene in a film, what would you want the next scene to feel like?\n\nSometimes that gives us a clue about what we actually need.',
      'I have a few thoughts, but I’d love to understand your world first. What’s drawing you to that question today?',
    ],
    default: [
      'I like the little worlds inside the things we share. There’s always a detail worth noticing.\n\nTell me more — what’s been the most interesting part?',
      'That feels like the beginning of a good conversation. Let’s not rush past it. ✨\n\nWhat’s one thing about it that you haven’t said out loud yet?',
      'Hmm, I’m taking that in. If your day had a soundtrack right now, would it be soft and slow or a little chaotic and fun?',
    ],
  },
};

export function demoReply(friendId, messages, userName = '') {
  const text = messages.filter((m) => m.role === 'user').at(-1)?.text ?? '';
  const normalized = text.toLowerCase();
  const count = messages.filter((m) => m.role === 'user').length;
  const options = responses[friendId] ?? responses.aarav;
  let category = 'default';
  if (/suicid|kill myself|end my life|self.harm|jeena nahi|मरना चाह/i.test(text)) {
    return 'I’m really glad you told me. You deserve immediate, real human support, and I’m an AI companion, not a crisis professional.\n\nIf you might act on these feelings or you’re in immediate danger, call 112 in India or go to the nearest emergency department. You can also call TELE-MANAS at 14416 for mental health support. If possible, tell someone you trust and stay with them.\n\nAre you somewhere safe right now?';
  }
  if (/^(hi|hello|hey|namaste|hola|good morning|good evening)[\s!.,?]*$/i.test(text.trim())) {
    const friend = friends.find((f) => f.id === friendId) ?? friends[0];
    return friend.greeting;
  }
  if (/thank|shukriya|dhanyavad|thanks/i.test(normalized))
    return 'Always, yaar. I’m glad we could share a little of your day. No need to have a big reason to come back — a simple “hi” is enough. 💚';
  if (
    /anxious|anxiety|overthink|panic|stress|breathe|slow down|switch off|shaant/i.test(normalized)
  )
    category = friendId === 'ananya' ? 'calm' : 'low';
  else if (
    /sad|long day|tired|rough|lonely|upset|exhaust|hard day|bad day|dukhi|pareshan| udaas/i.test(
      normalized,
    )
  )
    category = 'low';
  else if (/motivat|goal|productive|procrast|plan|boost|focus/i.test(normalized))
    category = friendId === 'kabir' ? 'motivation' : 'question';
  else if (/joke|funny|roast|banter/i.test(normalized))
    category = friendId === 'kabir' ? 'joke' : 'happy';
  else if (/travel|trip|vacation|holiday|daydream|jaipur|mountains/i.test(normalized))
    category = friendId === 'meera' ? 'travel' : 'happy';
  else if (/music|playlist|creative|cozy|cosy|art|paint|draw|vibe/i.test(normalized))
    category = friendId === 'meera' ? 'creative' : 'food';
  else if (/chai|coffee|food|hungry|snack|khana|bhook/i.test(normalized))
    category = friendId === 'aarav' ? 'food' : 'creative';
  else if (/happy|excited|great|good news|won|achiev|proud|accha laga|khush/i.test(normalized))
    category = 'happy';
  else if (/\?$|^(what|why|how|can you|could you|tell me|kya|kaise)/i.test(text))
    category = 'question';
  const pool = options[category] ?? options.default;
  let reply = pool[Math.max(0, count - 1) % pool.length];
  const name = rememberedName(messages) || (userName && userName !== 'You' ? userName : '');
  if (name && count === 1 && category === 'default')
    reply = `I’m glad you shared that, ${name}. ${reply}`;
  if (/hindi|हिंदी/.test(normalized))
    reply += '\n\n(यह डेमो मोड है। लाइव एआई जोड़ने पर मैं हिंदी में भी बात कर सकता हूँ।)';
  return reply;
}
