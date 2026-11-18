# TOTO SHOP — Cloudflare Worker + D1

বাংলা-ভিত্তিক অনলাইন শপ। এতে customer storefront, আলাদা admin panel, product management, order management, order tracking, COD, manual bKash/Nagad payment এবং Telegram/WhatsApp support link আছে। ডিজাইনের CSS/HTML অপরিবর্তিত রাখা হয়েছে; asset path ও deployment নির্দেশনা ঠিক করা হয়েছে।

## গুরুত্বপূর্ণ
- ZIP extract করলে `wrangler.toml`, `schema.sql`, `worker/` ও `public/` সরাসরি একই মূল ফোল্ডারে থাকবে। GitHub repository-তেও এগুলো repository root-এ upload করতে হবে; অতিরিক্ত `toto-shop/` parent folder-এর ভেতরে রাখবেন না।
- bKash/Nagad হলো **ম্যানুয়াল পেমেন্ট**, automatic gateway নয়। ক্রেতা টাকা পাঠিয়ে Transaction ID দেবে; Admin যাচাই করে payment status বদলাবেন।
- Database ID, Admin password এবং Session secret প্রতিটি অ্যাকাউন্টে আলাদা; এগুলো আপনাকেই Cloudflare-এ সেট করতে হবে। এগুলো ZIP থেকে আগে থেকে জানা সম্ভব নয়।
- Admin password বা Session secret GitHub-এ লিখবেন না।

## 1) GitHub repository
1. https://github.com/new খুলে `toto-shop` নামে repository তৈরি করুন।
2. Public বা Private যেকোনোটি ব্যবহার করা যাবে।
3. ZIP extract করে এর ভেতরের সব ফাইল ও ফোল্ডার repository root-এ upload করুন। `wrangler.toml` যেন repository-র প্রথম স্তরে থাকে।

## 2) D1 database তৈরি
1. Cloudflare Dashboard → Workers & Pages → D1 SQL Database → Create database।
2. নাম দিন `toto-shop-db`।
3. Database ID কপি করুন।
4. GitHub-এর `wrangler.toml` Edit করে `REPLACE_WITH_YOUR_D1_DATABASE_ID`-এর জায়গায় আপনার Database ID বসিয়ে Commit করুন।
5. D1 Database → Console-এ `schema.sql`-এর সম্পূর্ণ SQL চালান।

## 3) Worker secret তৈরি
Cloudflare Dashboard → Workers & Pages → `toto-shop` Worker (প্রথম deploy-এর পর) → Settings → Variables and Secrets-এ:
- `ADMIN_PASSWORD` (Secret): শক্তিশালী, আলাদা Admin password
- `SESSION_SECRET` (Secret): অন্তত 32 অক্ষরের random secret

## 4) GitHub থেকে Cloudflare deploy
1. Cloudflare Dashboard → Workers & Pages → Create application → Workers → Import a repository / Connect to Git।
2. GitHub authorize করে `toto-shop` repository নির্বাচন করুন।
3. Root directory ফাঁকা বা `/` রাখুন (কারণ `wrangler.toml` repository root-এ আছে)।
4. Build command ফাঁকা রাখুন। Deploy command দিন `npx wrangler deploy`।
5. Deploy সম্পন্ন হলে Worker Settings → Bindings-এ D1 binding পরীক্ষা করুন: Variable name `DB`, database `toto-shop-db`। Wrangler config-এ binding আগে থেকেই ঘোষিত আছে; Dashboard-এ duplicate binding তৈরি করবেন না।
6. Secrets যোগ করার পর আবার Deploy করুন, যদি Cloudflare নতুন deployment চায়।

> Cloudflare-এর dashboard-এর UI/label পরিবর্তিত হতে পারে। Import wizard যদি `wrangler.toml` স্বয়ংক্রিয়ভাবে শনাক্ত করে, config file-এর Worker entrypoint `worker/index.js` এবং assets directory `./public` ব্যবহার করবে।

## 5) সাইট ব্যবহার
- Storefront: আপনার `workers.dev` URL
- Admin: একই URL-এর শেষে `/admin.html`
- Admin-এ `ADMIN_PASSWORD` দিয়ে লগইন করুন।
- Settings থেকে দোকানের তথ্য, bKash/Nagad নম্বর, COD, delivery charge ও Telegram/WhatsApp link সেট করুন।
- Products থেকে পণ্য, দাম, stock ও image URL যোগ করুন।

## 6) পরীক্ষা
1. একটি test product যোগ করুন।
2. COD দিয়ে test order দিন।
3. Manual bKash/Nagad দিয়ে test order দিলে transaction ID-সহ order-এর payment status `submitted` হবে।
4. Admin থেকে order/payment status update করুন।
5. Storefront-এর tracking form দিয়ে order ID ও phone দিয়ে পরীক্ষা করুন।

## সীমাবদ্ধতা
এই starter-এ customer account, image upload storage, automated SMS, courier API বা automatic bKash/Nagad gateway নেই। পণ্যের ছবি public image URL দিয়ে দিতে হয়। Production-এ ব্যবহারের আগে test order, database backup এবং security review করুন।
