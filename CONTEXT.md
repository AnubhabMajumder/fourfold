# Fourfold

A personal task manager built around the Eisenhower Matrix: the user writes tasks down, then decides for themselves which quadrant each belongs in. Each user's tasks are private to them and follow them across their devices.

## Language

**Task**:
A single thing the user intends to do, written in their own words.
_Avoid_: Todo, item, card

**Task List**:
The single, ongoing list of Tasks the user has written but not yet placed. Every Task is written here first; it belongs to no date, and an unplaced Task waits there across days until the user places it into a Matrix. A Task in the Task List can be edited or deleted, but not completed.
_Avoid_: Inbox, backlog, today's list

**Matrix**:
The four-quadrant workspace where a user prioritizes the Tasks for one date. A Matrix exists only while it holds at least one placed Task: it comes into being with the first Placement and disappears if it is emptied before it freezes, so unused dates have none. Unfinished Tasks stay in their date's Matrix and are not carried forward.
_Avoid_: Board, grid, session

**Current Matrix**:
The newest Matrix, where new Placements go: normally today's, but from the evening the user can start tomorrow's early, which then becomes current. An earlier Matrix that is no longer current stays editable until it freezes.
_Avoid_: Active matrix, today's session

**Frozen Matrix**:
A Matrix that can no longer be changed, because its editing window has ended (a few hours into the following date). It remains viewable as a record of that date. Until it freezes, a Matrix stays editable even when it is no longer current.
_Avoid_: Archived matrix, closed matrix, locked session

**Quadrant**:
One of the four regions of the Matrix: Important + Urgent, Important + Not Urgent, Not Important + Urgent, Not Important + Not Urgent. Each Quadrant holds its placed Tasks as a single ordered list whose order is the user's to set, never the app's.
_Avoid_: Box, column, bucket

**Placement**:
The user's act of putting a Task into a Quadrant; a Task in a Quadrant is **placed**. Prioritization is always the user's judgment, never the app's. The user also chooses where in the Quadrant's list the Task goes, and can later move it to another position. A Task is only ever placed from the Task List: it cannot be written directly into a Quadrant, nor moved directly from one Matrix to another. Until its Matrix freezes, an unfinished placed Task can be returned to the Task List, leaving no trace in that Matrix.
_Avoid_: Categorize, sort, classify

**Completed Task**:
A placed Task the user has marked done. It stays in its Quadrant, marked with a scribbled strike-through, rather than disappearing. Completing a Task does not move it within its Quadrant. Only placed Tasks can be completed. Until its Matrix freezes, a Completed Task can be edited, moved to another Quadrant, or un-completed (becoming an ordinary placed Task again), but it cannot be deleted or returned to the Task List directly.
_Avoid_: Done item, archived task, deleted task

**Hub**:
A machine the user owns (e.g. their laptop) that keeps their Matrices and relays changes between their devices. One Hub holds exactly one person's Matrices. Not part of v1, which runs on a single laptop.
_Avoid_: Server, cloud, account

**Pairing**:
The one-time act of connecting a device to a Hub with a Pairing Code, after which the device syncs with it. Replaces signing in; there are no user accounts.
_Avoid_: Sign-in, login, registration

**Pairing Code**:
A short-lived code that works once and lets one new device pair. It can go either way: an already-paired device (or the Hub itself, for the first device) shows the code and the new device enters it, or the new device shows the code and an already-paired device enters it to let it in.
_Avoid_: Hub secret, password, invite

**Local-only**:
Using Fourfold with no Hub: the Matrices live in a single browser and never sync. A Local-only user can later pair with a Hub and keep their Tasks.
_Avoid_: Guest mode, offline mode, signed-out
