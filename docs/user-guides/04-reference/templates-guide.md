# Templates guide

When you create certain things in AMP Atlas, you don't have to start from a blank page — you
can start from a **template** that lays out the right structure with helpful prompts to fill
in. This guide explains the three templates you'll use and when to reach for each.

> **Templates are optional.** They're a convenience, not a requirement — a way to work in the
> AMP methodology without having to remember all the pieces yourself. If you'd rather build
> something your own way, you can; the templates are just there to make the common cases easy.

Templates exist because good structure makes work easier — for you *and* for anyone (or any
Claude) who picks it up later. Each template has **purple guidance notes** inside it; fill in
the sections in plain language and delete the notes as you go.

---

## The three templates

AMP Atlas has templates for the three kinds of things you'll add inside a System: a
**Project**, a **Playbook**, and a **Sub-system**. (A plain new file, by contrast, starts
blank.)

### Project — start with a braindump and a pitch
**Use it:** when you're kicking off a scoped piece of work with a beginning and an end.

Creating a Project starts you with two files:

- **Braindump** — an unstructured scratchpad. Dump raw thoughts, links, notes, and half-formed
  ideas as they come, with no need to organize. It's the safe place to get everything out of
  your head before you shape it. There's no wrong way to fill it in.
- **Pitch** — a short, plain-language case for *doing* this project, enough that someone new
  could understand what you're proposing and why. It walks through: **the problem**, **the
  proposed approach**, **why now**, **what success looks like**, **scope & boundaries**, and
  **open questions**.

The pitch is the agreement *before* the work starts — it's what a reviewer or teammate checks
the finished work against. As the project grows, you add your own working files and finished
results alongside these two.

### Playbook — a repeatable process
**Use it:** when you find yourself doing the same kind of work more than once and want to
capture *how* so it's reliable and shareable.

A **Playbook** captures a repeatable process so it can be run the same way every time, by a
person or by Claude. The template walks you through: **Purpose** (the messy "before" and clean
"after"), **Trigger** (what starts it), **Inputs** (what changes each run), **Workflow** (the
named steps, each producing one output), **Outputs** (the deliverables), and **Behavior
notes** (how it should run, any always/never rules).

A good playbook is specific enough that someone who's never done the task could follow it and
get a good result.

### Sub-system — a new area within a System
**Use it:** when a System is getting large and you're carving out a distinct area within it
that deserves its own clear description.

Creating a Sub-system gives you a **README** — an overview explaining what this area is, what
it owns, and the processes inside it. It covers the sub-system's **mission**, **where it fits**
in the broader System, **what it owns**, its **roles**, and its **core processes**.

---

## A note on a playbook's status

Playbooks carry a **Status** — a **quality grade** that signals how proven the playbook is. In
plain terms:

- **Not Yet Graded** — hasn't been formally reviewed for quality yet.
- **A** — great; trusted and proven.
- **B** — useful.
- **C** — not especially useful.
- **F** — not usable as-is.
- **Future** — a placeholder for something planned but not built yet.

Keeping this accurate is a small habit with a big payoff: it's how everyone — and Claude —
knows how much to trust a given playbook. You'll find and set it in the **properties** panel
when a playbook is open.

---

## Starting from a template in the app

You create these from the **file tree**, using the **+** button on the matching area of a
System:

- The **+** in the Playbooks area → **New playbook**.
- The **+** in the Work area → **New project** (braindump + pitch).
- The **+** in the Reference area → **New sub-system** (README).

AMP Atlas drops in the right template automatically, prompts and all. Replace the purple
guidance notes with your own content, and you're off. (Right-clicking to make a plain **New
file** gives you a blank document instead.)

![A freshly created pitch showing its section headings and purple guidance prompts](../images/template-pitch-example.png)
*A new template comes pre-filled with prompts to replace. (Optional screenshot.)*

---

**You should now know** which template to reach for — braindump + pitch for starting a
Project, the playbook template for a repeatable process, and the sub-system README for
defining an area — plus what a playbook's **status grade** is telling you.
