CREATE TABLE `parallaxe_sessions` (
	`code` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parallaxe_sessions_expiry` ON `parallaxe_sessions` (`expires_at`);