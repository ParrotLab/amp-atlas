# Troubleshooting & FAQ

Quick answers to the things that most often trip people up. If your question isn't here, check
the [everyday workflow guides](../03-everyday-workflows/) or open a
[GitHub issue](https://github.com/ParrotLab/amp-atlas/issues).

---

## Editing & saving

**"The editor won't let me type — is it broken?"**
Almost always, this means you're looking at the **Live Version**, which is read-only on
purpose (you'll see a **Read only** pill in the status bar). Make your changes in a **Draft**
instead: open the version switcher in the status bar and create or switch to a Draft, and
you'll be able to edit.

**"I made changes — why doesn't the rest of my team see them?"**
Because they're still in your **Draft**, which is private to you. Your team only sees changes
after your Draft is reviewed, approved, and **published** to the Live Version. This is by
design — it's what keeps the Live Version trustworthy. See
[Submitting your work for review](../03-everyday-workflows/submit-for-review.md).

**"What's the difference between Save, Submit, and Publish?"**
**Save** keeps your progress inside your Draft (private). **Submit for review** sends it to a
teammate to check. **Publish** — which you do *after* it's approved — makes it the new Live
Version for everyone. You Save constantly, submit when it's ready, and publish once approved.

---

## Drafts & versions

**"Where did my Draft go after I published it?"**
That's expected. Once a Draft is published, its changes *become* the Live Version, and the
Draft has done its job, so it's cleared away. Your work isn't lost — it's now part of the
official Live Version. If you need to make more changes, start a fresh Draft.

**"Is there an 'updates available' notice when the Live Version changes?"**
No — there's no badge to watch. AMP Atlas brings your Draft up to date **automatically when
you publish**, so you don't have to track it. If you're viewing the **Live Version** and want
the very latest, use the **Refresh** button in the status bar. See
[When the Live Version changes](../03-everyday-workflows/updates-and-conflicts.md).

**"I tried to publish and got a notice that the Live Version changed."**
Your Draft touched the same spot as a change someone else just published, so AMP Atlas paused
rather than guess. It's rare and nothing is lost. AMP Atlas opens a **pull request on GitHub**
so you can combine the two versions there: click **Resolve on GitHub** in the notice, use
GitHub's **Resolve conflicts** editor, merge, then hit **Refresh** back in AMP Atlas. See
[When the Live Version changes](../03-everyday-workflows/updates-and-conflicts.md).

**"I have a bunch of Drafts — how do I tell them apart?"**
By their names, and by the **status bar**, which always shows which Draft you're currently in.
Naming Drafts clearly when you create them ("Onboarding refresh," "Rubric fix") makes this
easy. See
[Working on several projects at once](../03-everyday-workflows/working-on-multiple-drafts.md).

**"Can I start a Draft based on another Draft I'm working on?"**
Not in this version — Drafts always start from the Live Version. (The New Draft window shows
this as an "Advanced" option, but it isn't available yet.) Get the first piece published, then
start fresh.

---

## Reviews

**"I'm reviewing a teammate's work — should I just fix it myself?"**
No — **don't edit someone else's Draft.** The Draft belongs to its author, so you give
feedback in a **note** and choose **Approve** or **Request changes**, and *they* make the
edits. This keeps ownership clear. See
[Reviewing someone else's work](../03-everyday-workflows/review-someones-work.md).

**"How do I comment on a specific line?"**
In AMP Atlas, a review is a **single note** plus your Approve / Request-changes decision —
there aren't per-line comments or comment threads inside the app. Put your points (and label
them *blocking* / *nitpick* / *question* / *praise* if it helps) in that one note. If you truly
need to point at an exact line for a technical teammate, use the quiet **View on GitHub** link.

**"Does approving publish the work?"**
No. **Approve is a sign-off**, not the final step. After approval, the *author* publishes it
from their **Inbox → Ready to publish**. Approval clears the way; publishing makes it live.

**"Someone requested changes on my Draft — do I start over?"**
No. Keep working in the **same Draft**: make the fixes, save, and submit again so your reviewer
can take another look. Nothing is lost and nothing restarts.

**"How do I know when something needs my review?"**
It shows up in your **Inbox**, under the **Needs your review** tab.

---

## Systems & setup

**"How do I create a brand-new System?"**
A System is just a GitHub repository on your computer. In this version you connect an existing
repo rather than creating one from scratch inside the app: make (or pick) a repo on GitHub,
clone it to your computer, then add it from the **Add system** tile on the dashboard or in
**Settings**. See
[Set up your account & first System](../01-getting-started/account-and-first-system.md).

**"AMP Atlas won't add my folder."**
That usually means the folder isn't a git repository connected to GitHub yet. Make sure you
picked a folder that's a clone of a GitHub repo (it will have a hidden `.git` folder inside).

---

## Account & connection

**"AMP Atlas is asking me to reconnect to GitHub."**
Your connection dropped (this happens occasionally — a token expiring, for example). Your local
work is fine. Just go to **Settings** and click **Connect to GitHub** to reconnect, the same
quick browser step as the first time.

**"I approved in the browser but AMP Atlas still says I'm not connected."**
Switch back to the AMP Atlas window and give it a moment. If it still doesn't update, click
**Connect to GitHub** again for a fresh code.

**"Do I need to know how to use GitHub?"**
No. AMP Atlas uses GitHub quietly underneath for version history and reviews, but you never
touch it directly. Connecting once is the only time GitHub comes up.

---

## Working with Claude

**"Claude changed things — is that safe? Did it touch the Live Version?"**
Safe, as long as Claude's work is happening in a **Draft** (the recommended setup). Claude works
in your System's folder *outside* AMP Atlas, and AMP Atlas shows you the result. Nothing becomes
official until it goes through the same **review** and gets published. See
[Coworking with Claude](../03-everyday-workflows/coworking-with-claude.md).

---

## Still stuck?

- Re-check the guide for the area you're in — most screens are covered in
  [Everyday Workflows](../03-everyday-workflows/).
- Search the [open issues](https://github.com/ParrotLab/amp-atlas/issues) — someone may have hit
  the same thing.
- If something seems genuinely broken, open a
  [bug report](https://github.com/ParrotLab/amp-atlas/issues/new?template=bug_report.yml).
  Your reports help make Atlas (and these docs) better.
