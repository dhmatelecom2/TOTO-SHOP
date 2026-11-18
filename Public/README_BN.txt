TOTO SHOP — সেটআপ নির্দেশিকা

এই প্যাকেজে:
- index.html / shop.css / shop.js: কাস্টমার ওয়েবসাইট
- admin.html / admin.css / admin.js: আলাদা অ্যাডমিন প্যানেল
- worker.js: Cloudflare Worker API
- schema.sql: D1 Database টেবিল

গুরুত্বপূর্ণ: এই প্যাকেজ একই Cloudflare Worker-এর Static Assets দিয়ে চালানোর জন্য সাজানো। এতে Admin এবং User একই origin-এ থাকবে, তাই HttpOnly Cookie কাজ করবে। GitHub Pages-এ শুধু HTML আপলোড করলে API/cookie সঠিকভাবে চলবে না।

১) Cloudflare Dashboard → Workers & Pages → আপনার Worker (যেমন toto-shop-api) → Settings → Bindings:
   D1 database binding: Variable name অবশ্যই DB; আপনার D1 database নির্বাচন করুন।
   Assets binding / Static assets: এই ZIP-এর ফাইলগুলো (worker.js ছাড়া) আপলোড করুন; Worker-এ ASSETS binding হবে।
২) D1 → Console-এ schema.sql-এর সম্পূর্ণ SQL রান করুন।
৩) Worker → Settings → Variables and Secrets-এ যোগ করুন:
   ADMIN_PASSWORD = আপনার গোপন অ্যাডমিন পাসওয়ার্ড (Secret)
   SESSION_SECRET = অন্তত 32 অক্ষরের এলোমেলো গোপন মান (Secret)
৪) worker.js কোড Deploy করুন।
৫) আপনার Worker URL খুললে User website; /admin.html খুললে Admin panel।
৬) Admin লগইন হবে ADMIN_PASSWORD দিয়ে।

সতর্কতা:
- প্রথমে পরীক্ষামূলকভাবে অল্প কয়েকটি পণ্য দিয়ে পরীক্ষা করুন।
- অর্ডার সাবমিটের সময় API-তে payment method ও transaction ID যাচাই হয়; অনলাইন পেমেন্টের প্রকৃত টাকা স্বয়ংক্রিয়ভাবে যাচাই হয় না। Admin-কে পেমেন্ট যাচাই করে status Paid করতে হবে।
- বর্তমান User page-এ পণ্য অর্ডার বোতাম WhatsApp message তৈরি করে; পূর্ণ checkout/cart/payment flow এখনো তৈরি করা হয়নি।
- Worker-এ error details ইচ্ছাকৃতভাবে browser-এ প্রকাশ করা হয় না।
