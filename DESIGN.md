# Design Doc for Kobo to Markdown tool

This document outlines the design and architecture of the Kobo to Markdown tool, 
which is a TUI (Text User Interface) application for converting Kobo eReader notes and highlights into Markdown files suitable for Obsidian.

The application is shortend to KTM after this point.

## Workflow

- User points KTM at an `.epub` file, with matching `.annot`
    - Kobo stores these under `Books/**.epub` and `Digital Editions/Annotations/Books/**.annot` respectively
    - `Annotations` matches the folder structure of `Books`
        - e.g `Books/Programming/Intro_To_JavaScript.epub` annotations are stored under `Digital Editions/Annotations/Books/Programming/Intro_To_JavaScript.annot`
- KTM extracts the necessary data
    - Table of Contents from the `epub`
    - Publication from `.annot`
        - Title
        - Creator
    - All annotations
        - start (where is the annotation)
        - text
        - color (kobo supports different color highlights)
- All this data is fed into an LLM which makes a first pass of sorting the notes into their respective chapters and turning them into cohesive bullete points
- Output is shown to the user in the TUI
- User can suggest changes to the LLM
- Once satisfied, user can save the output to a file

## Tech Stack

- Language = Typescript using Bun
    - Use bun specific commands where possible
- Interface = React (using [Ink](https://github.com/vadimdemedes/ink))
- LLM Provider = OpenAI