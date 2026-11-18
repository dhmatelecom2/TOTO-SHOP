-- Cloudflare D1 SQL: Run this entire file in the D1 Console.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT DEFAULT '',description TEXT DEFAULT '',price INTEGER NOT NULL DEFAULT 0,old_price INTEGER,image_url TEXT DEFAULT '',stock INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,address TEXT DEFAULT '',password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS customer_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expiry ON customer_sessions(expires_at);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,customer_id TEXT,customer_name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,note TEXT DEFAULT '',payment_method TEXT NOT NULL,payment_number TEXT DEFAULT '',transaction_id TEXT DEFAULT '',items_json TEXT NOT NULL,subtotal INTEGER NOT NULL,delivery_charge INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',payment_status TEXT NOT NULL DEFAULT 'unpaid',created_at TEXT NOT NULL DEFAULT (datetime('now')),FOREIGN KEY(customer_id) REFERENCES customers(id));
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
INSERT OR IGNORE INTO settings(key,value) VALUES('shop_name','TOTO SHOP'),('tagline','Premium Collection'),('announcement','TOTO SHOP • PREMIUM COLLECTION'),('delivery_charge','80'),('cod_enabled','1'),('bkash_enabled','1'),('nagad_enabled','1');
