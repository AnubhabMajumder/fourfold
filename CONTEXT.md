# Fourfold

A personal task manager built around the Eisenhower Matrix: the user writes tasks down, then decides for themselves which quadrant each belongs in. Each user's tasks are private to them and follow them across their devices.

## Language

**Task**:
A single thing the user intends to do, written in their own words.
_Avoid_: Todo, item, card

**Matrix**:
The four-quadrant workspace where a user's tasks are prioritized.
_Avoid_: Board, grid

**Quadrant**:
One of the four regions of the Matrix: Important + Urgent, Important + Not Urgent, Not Important + Urgent, Not Important + Not Urgent.
_Avoid_: Box, column, bucket

**Placement**:
The user's act of putting a Task into a Quadrant; a Task in a Quadrant is **placed**. Prioritization is always the user's judgment, never the app's.
_Avoid_: Categorize, sort, classify

**Completed Task**:
A Task the user has marked done. It stays in its Quadrant, marked with a scribbled strike-through, rather than disappearing.
_Avoid_: Done item, archived task, deleted task

**Hub**:
A machine the user owns (e.g. their laptop) that keeps their Matrix and relays changes between their devices. One Hub holds exactly one person's Matrix.
_Avoid_: Server, cloud, account

**Pairing**:
The one-time act of connecting a device to a Hub using the Hub's address and secret, after which the device syncs with it. Replaces signing in; there are no user accounts.
_Avoid_: Sign-in, login, registration

**Local-only**:
Using Fourfold with no Hub: the Matrix lives in a single browser and never syncs. A Local-only user can later pair with a Hub and keep their Tasks.
_Avoid_: Guest mode, offline mode, signed-out
