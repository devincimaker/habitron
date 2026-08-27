-- "Auto pop-up of habit log" is gone from the composer (HAB-150 row 3): no live
-- habit had it on, and the log sheet already opens for the case that needs it
-- (a quantity habit with manual check-in).
ALTER TABLE habits DROP COLUMN auto_popup_log;
