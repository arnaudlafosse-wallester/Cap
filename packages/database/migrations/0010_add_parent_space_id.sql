ALTER TABLE `spaces` ADD `parentSpaceId` varchar(36);--> statement-breakpoint
CREATE INDEX `parent_space_id_idx` ON `spaces` (`parentSpaceId`);
