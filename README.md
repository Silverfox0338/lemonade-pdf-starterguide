# Lemonade.gg Starter Guide

A comprehensive beginner-to-advanced guide for [Lemonade.gg](https://lemonade.gg), the AI coding tool built specifically for Roblox game developers.

Written by **Silverfox0338**.

---

## What Is This?

This repo hosts the source content for the **Lemonade.gg Dummies Guide**, a full wiki covering everything from what Lemonade is, how to set it up, how to write great prompts, and how to build your first Roblox game with it.

Whether you have never touched a line of code or you are an experienced developer looking to move faster, the guide is written to be useful to you.

---

## Read the Guide

The full guide is published as a GitHub Wiki:

**[View the Lemonade.gg Starter Guide Wiki](../../wiki)**

The repo also stores an auto-generated master PDF:

- `pdf/Lemonade.gg-Starter-Guide-latest.pdf`
- Versioned PDF history in `pdf/history/`

---

## What Is Covered

| Chapter | Topic |
|---|---|
| Chapter 1 | What Is Lemonade.gg? |
| Chapter 2 | Roblox Basics You Need to Know |
| Chapter 3 | Getting Started |
| Chapter 4 | What Lemonade Can Build |
| Chapter 5 | The Day-to-Day Workflow |
| Chapter 6 | Writing Great Prompts |
| Chapter 7 | Debugging and Fixing Issues |
| Chapter 8 | Building Your First Game |
| Chapter 9 | Tips, Tricks, and Advanced Usage |
| Chapter 10 | Limitations and What to Expect |
| Chapter 11 | Frequently Asked Questions |
| Glossary | Glossary of Terms |

---

## About Lemonade.gg

Lemonade.gg is an AI-powered coding tool for Roblox game development. You describe what you want in plain English, and it generates working Luau scripts and GUIs that sync directly into Roblox Studio through a plugin. No coding experience required.

- **Free plan**: 1 credit per day
- **Pro plan**: $19.99/month, daily stacking credits, larger project support, up to 10 projects
- **Credit packs**: One-time purchases starting at $4.99

Find Lemonade at [lemonade.gg](https://lemonade.gg).

---

## Notes

The `.wiki/` folder in this repo contains the local copy of the wiki for editing. It is excluded from the main repo via `.gitignore` since it is a separate git repository that syncs to the GitHub Wiki.

The main repo includes a GitHub Actions workflow that listens for wiki updates and rebuilds a single master PDF automatically. Each new wiki revision produces the next patch version in the PDF history, starting from `1.0.1`.
