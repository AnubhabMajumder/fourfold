# Fourfold

A personal task manager built around the Eisenhower Matrix: the user writes tasks down, then decides for themselves which quadrant each belongs in. Each user's tasks are private to them and follow them across their devices.

## Language

**Task**:
A single thing the user intends to do, written in their own words.
_Avoid_: Todo, item, card

**Task List**:
The single, ongoing list of Tasks the user has written but not yet placed. It belongs to no date: an unplaced Task waits there across days until the user places it into a Matrix.
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
One of the four regions of the Matrix: Important + Urgent, Important + Not Urgent, Not Important + Urgent, Not Important + Not Urgent.
_Avoid_: Box, column, bucket

**Placement**:
The user's act of putting a Task into a Quadrant; a Task in a Quadrant is **placed**. Prioritization is always the user's judgment, never the app's. Until its Matrix freezes, a placed Task can be returned to the Task List, leaving no trace in that Matrix.
_Avoid_: Categorize, sort, classify

**Completed Task**:
A Task the user has marked done. It stays in its Quadrant, marked with a scribbled strike-through, rather than disappearing.
_Avoid_: Done item, archived task, deleted task

**Hub**:
A machine the user owns (e.g. their laptop) that keeps their Matrices and relays changes between their devices. One Hub holds exactly one person's Matrices.
_Avoid_: Server, cloud, account

**Pairing**:
The one-time act of connecting a device to a Hub using the Hub's address and secret, after which the device syncs with it. Replaces signing in; there are no user accounts.
_Avoid_: Sign-in, login, registration

**Local-only**:
Using Fourfold with no Hub: the Matrices live in a single browser and never sync. A Local-only user can later pair with a Hub and keep their Tasks.
_Avoid_: Guest mode, offline mode, signed-out
