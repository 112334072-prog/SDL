-- ============================================================
--  biker_final.sql — Biker Gallery (Updated with Deposit System)
--  Run: phpMyAdmin → SQL tab → paste → Go
--  OR:  mysql -u root -p < biker_final.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `biker`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `biker`;

-- TABLE 1: users
CREATE TABLE IF NOT EXISTS `users` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `username`   VARCHAR(50)  NOT NULL UNIQUE,
    `full_name`  VARCHAR(100) NOT NULL,
    `dob`        DATE         NOT NULL,
    `email`      VARCHAR(100) NOT NULL UNIQUE,
    `phone`      VARCHAR(10)  NOT NULL,
    `password`   VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 2: admin_login
CREATE TABLE IF NOT EXISTS `admin_login` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `full_name`  VARCHAR(100) NOT NULL,
    `username`   VARCHAR(50)  NOT NULL UNIQUE,
    `email`      VARCHAR(100) NOT NULL UNIQUE,
    `phone`      VARCHAR(20)  NOT NULL,
    `password`   VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 3: menu
CREATE TABLE IF NOT EXISTS `menu` (
    `id`        INT          NOT NULL AUTO_INCREMENT,
    `bike_name` VARCHAR(100) NOT NULL UNIQUE,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 4: bikes
CREATE TABLE IF NOT EXISTS `bikes` (
    `id`        INT          NOT NULL AUTO_INCREMENT,
    `bike_name` VARCHAR(100) NOT NULL UNIQUE,
    `category`  ENUM('125cc','200cc','premium') NOT NULL,
    `engine`    VARCHAR(20)  NOT NULL,
    `mileage`   VARCHAR(20)  NOT NULL,
    `gearbox`   VARCHAR(20)  NOT NULL,
    `type`      VARCHAR(30)  NOT NULL,
    `price_hr`  INT          NOT NULL,
    `price_day` INT          NOT NULL,
    `img_path`  VARCHAR(100) NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 5: bookings (with deposit fields)
CREATE TABLE IF NOT EXISTS `bookings` (
    `id`              INT          NOT NULL AUTO_INCREMENT,
    `bike_name`       VARCHAR(100) NOT NULL,
    `customer_name`   VARCHAR(100) NOT NULL,
    `phone`           VARCHAR(10)  NOT NULL,
    `pickup_date`     DATE         NOT NULL,
    `pickup_time`     TIME         NOT NULL,
    `hours`           INT          NOT NULL,
    `rate`            INT          NOT NULL,
    `gst`             INT          NOT NULL,
    `total`           INT          NOT NULL,
    `deposit`         INT          NOT NULL DEFAULT 2500,
    `actual_hours`    INT          NULL DEFAULT NULL,
    `refund_amount`   INT          NULL DEFAULT NULL,
    `status`          ENUM('active','returned') NOT NULL DEFAULT 'active',
    `returned_at`     TIMESTAMP    NULL DEFAULT NULL,
    `booked_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bike_name` (`bike_name`),
    KEY `idx_status`    (`status`),
    KEY `idx_pickup`    (`pickup_date`, `pickup_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SEED DATA: menu (10 bikes)
INSERT IGNORE INTO `menu` (`bike_name`) VALUES
  ('Honda SP 125'),
  ('Hero Xtreme 125R'),
  ('Bajaj Pulsar NS125'),
  ('Honda Activa 125'),
  ('Bajaj Pulsar NS200'),
  ('TVS Apache RTR 200 4V'),
  ('Yamaha MT-15'),
  ('Hero XF3R'),
  ('Honda CBR300R'),
  ('Benelli TNT 300');

-- SEED DATA: bikes
INSERT IGNORE INTO `bikes`
  (`bike_name`, `category`, `engine`, `mileage`, `gearbox`, `type`, `price_hr`, `price_day`, `img_path`)
VALUES
('Honda SP 125',          '125cc',   '125cc', '65 kmpl', 'Manual',    'Commuter', 20, 480,  'img/honda_sp125.jpg'),
('Hero Xtreme 125R',      '125cc',   '125cc', '60 kmpl', 'Manual',    'Sports',   22, 520,  'img/hero_xtreme125r.jpg'),
('Bajaj Pulsar NS125',    '125cc',   '125cc', '55 kmpl', 'Manual',    'Sports',   22, 520,  'img/bajaj_pulsar_ns125.jpg'),
('Honda Activa 125',      '125cc',   '125cc', '60 kmpl', 'Automatic', 'Scooter',  18, 440,  'img/honda_activa125.jpg'),
('Bajaj Pulsar NS200',    '200cc',   '200cc', '40 kmpl', 'Manual',    'Sports',   35, 800,  'img/bajaj_pulsar_ns200.jpg'),
('TVS Apache RTR 200 4V', '200cc',   '197cc', '35 kmpl', 'Manual',    'Sports',   38, 880,  'img/tvs_apache_rtr200.jpg'),
('Yamaha MT-15',          '200cc',   '155cc', '43 kmpl', 'Manual',    'Naked',    40, 920,  'img/yamaha_mt15.jpg'),
('Hero XF3R',             'premium', '210cc', '30 kmpl', 'Manual',    'Sports',   60, 1400, 'img/hero_xf3r.jpg'),
('Honda CBR300R',         'premium', '286cc', '28 kmpl', 'Manual',    'Sport',    75, 1700, 'img/honda_cbr300r.jpg'),
('Benelli TNT 300',       'premium', '300cc', '25 kmpl', 'Manual',    'Naked',    80, 1800, 'img/benelli_tnt300.jpg');

-- ============================================================
--  MIGRATION — run this if upgrading an EXISTING database
--  (safe to run even if columns already exist — uses IF NOT EXISTS style)
-- ============================================================

-- Step 1: Add pickup_time column (critical — was missing from older schema)
ALTER TABLE `bookings`
  ADD COLUMN IF NOT EXISTS `pickup_time`    TIME         NOT NULL DEFAULT '09:00:00' AFTER `pickup_date`;

-- Step 2: Add deposit + return tracking columns
ALTER TABLE `bookings`
  ADD COLUMN IF NOT EXISTS `deposit`        INT          NOT NULL DEFAULT 2500       AFTER `total`,
  ADD COLUMN IF NOT EXISTS `actual_hours`   INT          NULL DEFAULT NULL            AFTER `deposit`,
  ADD COLUMN IF NOT EXISTS `refund_amount`  INT          NULL DEFAULT NULL            AFTER `actual_hours`,
  ADD COLUMN IF NOT EXISTS `returned_at`    TIMESTAMP    NULL DEFAULT NULL            AFTER `status`;

-- Step 3: Remove old availability column from menu/bikes if present
ALTER TABLE `menu`  DROP COLUMN IF EXISTS `availability`;
ALTER TABLE `bikes` DROP COLUMN IF EXISTS `availability`;

-- Step 4: Reset hours=0 for any old open-ended bookings that used hours>0
-- (optional — only if you want consistent open-ended logic)
-- UPDATE `bookings` SET hours=0 WHERE status='active';

SHOW TABLES;
