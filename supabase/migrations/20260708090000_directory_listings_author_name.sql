-- Migration: directory_listings — author_name column (carried 42+ days, requested by Patrik 2026-06-25, mis-applied to wrong project originally)
alter table directory_listings add column if not exists author_name text;
