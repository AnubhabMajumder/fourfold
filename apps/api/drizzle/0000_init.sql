CREATE TABLE `matrices` (
	`date` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`matrix_date` text,
	`quadrant` text,
	`position` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`matrix_date`) REFERENCES `matrices`(`date`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tasks_text_not_empty" CHECK(length(trim("tasks"."text")) > 0),
	CONSTRAINT "tasks_placed_in_a_quadrant" CHECK(("tasks"."matrix_date" is null) = ("tasks"."quadrant" is null)),
	CONSTRAINT "tasks_completed_only_when_placed" CHECK("tasks"."completed_at" is null or "tasks"."matrix_date" is not null)
);
--> statement-breakpoint
CREATE INDEX `tasks_by_list` ON `tasks` (`matrix_date`,`quadrant`,`position`);