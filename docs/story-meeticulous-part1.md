# Meeticulous — Part 1: The Rebuild

_Memoir draft. First person. Real people, fake-but-true conversations. Built to grow._

---

## I

It's 2:14 in the morning and my finger is hovering over a button that says **Deploy to Production**.

Funny thing about that button. It doesn't know that I have rewritten this entire product from scratch. It doesn't know there's a PHP version still running on three customers' servers right now, quietly taking bookings while I sit here trying to replace it. It doesn't know about the nights, the fights, the people who paid for my Claude subscription so I could keep going. It's just a button. Grey, rounded corners, a little loading spinner waiting to be summoned.

People think a startup is born the day you launch. It's not. It's born a hundred small times, in a hundred small rooms, in conversations you didn't know were important until much later.

So before I press this button, let me tell you about the rooms. And the people in them.

---

## II — The gist of how it started

The first version of Meeticulous wasn't called Meeticulous, and it wasn't pretty.

It was PHP and SQL, held together by Naman and me, two guys who didn't fully know what we were building until people started paying for it. A coach wanted a page where clients could book her time and pay. We built it. Then a tutor wanted the same. Then a physiotherapist. Then a coworking space wanted to rent out desks by the hour.

We weren't a company. We were a favor that kept getting requested.

The thing actually worked. That's the part nobody believes. Real people, real money, real bookings — on software two college-brained engineers wrote between deadlines. Every new customer meant Naman and I would SSH into yet another server at midnight, run the install, fix the one thing that always broke, and call it a launch.

We loved it. We also couldn't scale it to save our lives.

That's the whole origin in one breath: _a thing that worked, that we couldn't give to more people without breaking ourselves._ Everything after this is the story of trying to fix that — and what it cost.

---

## III — Naman, and the code we had to leave

I told Naman over a video call. He had his earphones in, half-eating something, the way he always is.

"I want to rebuild the whole thing," I said. "New stack. Supabase, Next.js. Throw away the PHP."

He stopped chewing.

"Throw away _our_ PHP."

"Yeah."

He was quiet for a second, and that second was longer than it should have been. We built that codebase. Bad variable names, a payments function we were both a little scared of, comments in Hinglish that only the two of us understood. It was ugly and it was ours.

"You know it works, right?" he said finally. "Like, it actually works. People are paying."

"That's exactly the problem," I said. "It works for three people and it works because you and I are awake at 1 AM whenever it doesn't. We can't sell that to a hundred coaches. Nobody wants to self-host a booking page, Naman. They want to sign up and be live in two minutes."

He nodded slowly, the way you nod when you agree but you're still grieving.

"So I'm just... not part of this new thing?"

And there it was. The real question under the technical one.

"You're the reason there's anything to rebuild," I told him. "The PHP version is the customer feedback. It's the proof. I'm not throwing away your work — I'm carrying the only valuable part of it forward. The lessons. We learned what to build by building it wrong first."

He laughed, a tired laugh. "Build it wrong first. Put that on a t-shirt."

"I will. I'll make you wear it."

We didn't fix everything in that call. You don't. But when I hung up, I opened an empty repo and typed the first command, and it felt less like a betrayal and more like keeping a promise.

---

## IV — Vishal, who bets on people for twenty dollars

Here is something I will never fully be able to repay.

I was stuck. Not technically — emotionally. The kind of stuck where you stare at a working feature and feel nothing. I told Vishal about it over chai, expecting nothing, because what do you say to that.

He didn't give me a speech.

He said, "You're using the free AI thing, no? The limited one?"

"Yeah."

He took out his phone, did something for thirty seconds, and slid it across the table. "Done. Twenty dollars. It's the paid plan now. Stop fighting the tool."

"Vishal, you don't have to—"

"I know I don't have to." He put his phone back in his pocket like the matter was closed. "I'm not paying for software. I'm paying because you build things you love, and the world is short on people who do that. Twenty dollars to keep one of them going is the cheapest thing I'll buy all year."

A month later, when I hit the wall again, he upgraded it without me asking. No message. I just noticed the limits were gone.

People think funding is term sheets and big rounds. For me, in the season that mattered most, funding was a friend who refused to let me blame my tools, who bought belief in increments of twenty dollars. There's a version of Meeticulous that dies in a low week without Vishal quietly removing the friction. That version is real. I think about it.

---

## V — Sujata, my partner, and the art she keeps teaching me

Sujata and I fight well. That's the best thing I can say about a partnership.

She came into the room while I was building, which is the worst time to talk to me, and she knew it, and she did it anyway.

"Who are we for?" she asked.

"What?"

"The new version. Who is it _for_. Say a person. Not 'creators.' A person."

I gave her the deck answer. "Coaches, consultants, tutors, physios—"

"That's a list, not a person." She sat on the edge of the desk. "Listen. You keep selling the booking page. Don't. Nobody wakes up wanting a booking page. They wake up tired of WhatsApp-ing strangers to fix a time, tired of chasing payments, tired of looking unprofessional. Sell them _the end of that_. The page is just how they get it."

I'd heard her say versions of this before. It never stops being true.

"You're the engineer," she said, softer now. "You fall in love with what it _does_. I fall in love with what it _removes_ from someone's day. We need both or this is just a clever toy."

Then, because she's Sujata, she ruined the moment perfectly: "Also your pricing page makes me want to nap. We're rewriting it. Fifth time. I counted."

"It's fine the way it is."

"It's not, and you know it's not, which is why you said it like that."

She was right. We rewrote it. Again.

---

## VI — Durga, who carries the part of me that's tired

Durga handles marketing. Durga also handles me, which is a harder job and she doesn't bill for it.

It was late. I'd been quiet for two days — the bad quiet, the kind where you're present in body and gone everywhere else. She didn't ask if I was okay, because she knows I'll say yes on reflex.

She just said, "Show me the thing that's bothering you."

I showed her the screen. A migration had nearly wiped my bookings table that week. A schema change went wrong, inserts started failing in the logs, and for about ten minutes I genuinely thought I'd lost real data. I'd fixed it. But the fear stays in your hands longer than the bug does.

"You fixed it though," she said.

"I fixed it. But it scared me. What if next time it's not test data. What if it's someone's actual client, actual money."

She didn't tell me it would be fine. That's why I trust her. She said, "Then you build it so that fear is impossible, not unlikely. And then you let me tell people that their data is safe with you — and I'll only say it if you've earned it. So earn it."

Marketing, from her, is not lipstick on a product. It's a promise she refuses to make on my behalf until it's true. She protects the customer from my optimism. Do you know how rare that is?

Later she added, quietly, not as a strategist, just as her: "You're allowed to be tired. You're not allowed to disappear. Big difference. Come back when you go quiet. That's all I ask."

I'm putting that in writing here so I don't forget it the next time I go quiet.

---

## VII — The people we actually built it for

A product becomes real the day a stranger needs it more than you do.

**Mukesh** runs a coworking space. He was almost a customer on the old PHP version and got scared off by the setup. When I called him about the new one, he didn't let me finish the pitch.

"Can people book a desk and pay before they walk in?"

"Yes."

"On their phone? No app download?"

"Just a link. They get a one-time code, they pay, done. No account needed."

There was a pause, and then the sentence that paid for a hundred late nights: "Bhai, send it to me today. I've been losing walk-ins because my front desk can't take bookings after 8 PM. Your software doesn't sleep, no?"

"It doesn't sleep."

"Then send it. Today."

**Yukta** is a physiotherapist, and Yukta is the reason a feature exists the way it does. She called, a little annoyed, which is the best kind of feedback.

"Your reschedule thing is wrong," she said.

"Wrong how?"

"A patient asked to move their slot. Your system just... let me move it. It moved their booking and I _assumed_ they'd seen the new time. They hadn't. They showed up at the old time. Empty room. Awkward."

I felt that one in my stomach, because she was completely right.

"You built it like the host is god," she said. "I'm not god. My patients have lives. When I move something, _they_ have to say yes to the new time. Not me deciding for them."

We changed it. Reschedules now wait for the guest to acknowledge before they're final. One physiotherapist's annoyed phone call beat a week of my own assumptions. That's the whole job, really. Build it wrong first. Let the right person be annoyed at you. Fix it.

**Himanshi** is an entrepreneur, and Himanshi scared me, in a good way, because she asked the question I was avoiding.

"What happens to me if you shut down?" she said. Not unkind. Just clear. "I'm going to put my whole booking flow on your thing. My income runs through it. So tell me honestly — am I betting on a product, or on a guy who might get bored?"

I didn't give her a sales answer. I told her about the three PHP customers still running, two years on. I told her about Naman, about the rebuild, about why I tore down something that worked instead of coasting on it.

She listened, then said, "Okay. That's the answer I wanted. Not that you're sure you'll win. That you've already refused the easy version once. People who do that don't get bored."

I sat with that for a long time.

---

## VIII — My mother, and the line I keep coming back to

My mother does not know what Supabase is. My mother thinks "deploy" is a thing the army does.

But she called the night before launch, the way she always knows to, without knowing why.

"You're not sleeping," she said. Statement, not question.

"Big day tomorrow, Ma. The new website. It goes out for everyone."

"The one you broke the old one to make?"

I laughed. "I didn't break it. I replaced it."

"Same thing for a mother. You had something that worked and you made it harder for yourself because you thought you could do better." A pause. "That's not a complaint, beta. That's the only thing I ever did right with my life. I made it harder for myself because I thought my children deserved better than what worked."

I didn't have anything to say to that.

"Your father would have told you to keep the safe thing," she said. "I'm telling you what I always tell you. Don't be afraid of the people who only respect the safe path. Be afraid of going to sleep having never tried the thing you couldn't stop thinking about. You've got your mother on your side. You always did. Now go to sleep. The button will still be there in the morning."

The button is, in fact, still here. 2:14 became 2:51 while I wrote this.

---

## IX

So here we are. The rooms are quiet now. Naman's asleep with his earphones still in, probably. Vishal has no idea his twenty dollars is in a memoir. Sujata is already drafting the launch post that I'll argue with and then approve. Durga made me promise to come back if I go quiet. Mukesh wants the link _today_, Yukta made the product more honest, Himanshi made me admit why I'm doing this at all. And my mother thinks deploy is a military operation.

I have rebuilt a thing that already worked, on a stack I had to learn, because three people loved the broken version enough to make me believe a hundred could love a better one.

My finger is on the button.

I'll tell you what happens in Part 2.

But between you and me — I already know. You don't get this far, with these people, to walk away from the door.

I'm pressing it.

---

_Cast carried into Part 2: **Naman** (the one who built it wrong-first with me), **Vishal** (the believer who funds in small, unforgettable amounts), **Sujata** (partner; teaches me to sell the absence of pain, not the feature), **Durga** (marketing + the keeper of my honesty and my tiredness), **Mukesh / Yukta / Himanshi** (the customers who validate, correct, and challenge), **Ma** (the spine)._
