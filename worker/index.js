const corsHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders });

const text = (s, max = 500) => String(s ?? "").trim().slice(0, max);
const id = () => crypto.randomUUID();
const money = n => Math.max(0, Math.round(Number(n) || 0));

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function makeSession(secret) {
  const payload = btoa(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, nonce: id() }));
  return `${payload}.${await sign(payload, secret)}`;
}
async function validSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.split(";").map(x => x.trim()).find(x => x.startsWith("toto_admin="))?.slice(11);
  if (!token || !env.SESSION_SECRET) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || await sign(payload, env.SESSION_SECRET) !== signature) return false;
  try { return JSON.parse(atob(payload)).exp > Date.now(); } catch { return false; }
}
const cookie = (value, age) => `toto_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;


// Customer accounts use a separate cookie/session store from the admin login.
const customerCookie = (value, age) => `toto_customer=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 120000, hash: "SHA-256" }, material, 256);
  return b64url(bits);
}
async function tokenDigest(token) {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}
async function newCustomerSession(db, customerId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await tokenDigest(token);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(?,?,?)").bind(customerId, tokenHash, expires).run();
  return token;
}
async function currentCustomer(request, env) {
  const raw = request.headers.get("Cookie") || "";
  const token = raw.split(";").map(x => x.trim()).find(x => x.startsWith("toto_customer="))?.slice(14);
  if (!token) return null;
  const tokenHash = await tokenDigest(token);
  const row = await env.DB.prepare(`SELECT c.id,c.name,c.phone,c.address,c.created_at
    FROM customer_sessions s JOIN customers c ON c.id=s.customer_id
    WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash, new Date().toISOString()).first();
  return row || null;
}

async function allSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries((rows.results || []).map(r => [r.key, r.value]));
}
async function requireAdmin(request, env) {
  return await validSession(request, env);
}
async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === "/api/health") return json({ ok: true, shop: env.SHOP_NAME || "TOTO SHOP" });

      if (path === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id,name,category,description,price,old_price,image_url,stock FROM products WHERE active=1 ORDER BY created_at DESC"
        ).all();
        return json({ products: results || [] });
      }

      if (path === "/api/settings" && method === "GET") {
        const s = await allSettings(env.DB);
        return json({
          shop_name: s.shop_name || "TOTO SHOP",
          tagline: s.tagline || "",
          announcement: s.announcement || "",
          telegram_url: s.telegram_url || "",
          whatsapp_url: s.whatsapp_url || "",
          delivery_charge: money(s.delivery_charge),
          cod_enabled: s.cod_enabled !== "0",
          bkash_enabled: s.bkash_enabled !== "0",
          nagad_enabled: s.nagad_enabled !== "0",
          bkash_number: s.bkash_number || "",
          nagad_number: s.nagad_number || "",
          hero_title: s.hero_title || "",
          hero_subtitle: s.hero_subtitle || ""
        });
      }

      if (path === "/api/orders" && method === "POST") {
        const b = await body(request);
        const customer = text(b.customer_name, 100), phone = text(b.phone, 30), address = text(b.address, 500);
        if (!customer || !phone || !address || !Array.isArray(b.items) || !b.items.length || b.items.length > 30)
          return json({ error: "সব প্রয়োজনীয় তথ্য দিন।" }, 400);
        const settings = await allSettings(env.DB);
        const methodName = text(b.payment_method, 20);
        if (!["cod", "bkash", "nagad"].includes(methodName)) return json({ error: "পেমেন্ট পদ্ধতি সঠিক নয়।" }, 400);
        if (methodName === "cod" && settings.cod_enabled === "0") return json({ error: "ক্যাশ অন ডেলিভারি বন্ধ আছে।" }, 400);
        if (methodName === "bkash" && settings.bkash_enabled === "0") return json({ error: "বিকাশ পেমেন্ট বন্ধ আছে।" }, 400);
        if (methodName === "nagad" && settings.nagad_enabled === "0") return json({ error: "নগদ পেমেন্ট বন্ধ আছে।" }, 400);

        let subtotal = 0, cleanItems = [];
        for (const item of b.items) {
          const pid = text(item.id, 80), qty = Math.max(1, Math.min(99, Math.floor(Number(item.qty) || 1)));
          const product = await env.DB.prepare("SELECT id,name,price,stock FROM products WHERE id=? AND active=1").bind(pid).first();
          if (!product || product.stock < qty) return json({ error: `“${product?.name || "একটি পণ্য"}” পর্যাপ্ত স্টকে নেই।` }, 409);
          subtotal += product.price * qty;
          cleanItems.push({ id: product.id, name: product.name, price: product.price, qty });
        }
        const delivery = money(settings.delivery_charge), total = subtotal + delivery;
        const orderId = "TOTO-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 4).toUpperCase();
        const payNumber = methodName === "bkash" ? settings.bkash_number : methodName === "nagad" ? settings.nagad_number : "";
        const txid = text(b.transaction_id, 100);
        if (methodName !== "cod" && !txid) return json({ error: "ট্রানজেকশন আইডি দিন।" }, 400);

        const signedInCustomer = await currentCustomer(request, env);
        const statements = [
          env.DB.prepare(`INSERT INTO orders
            (id,customer_id,customer_name,phone,address,note,payment_method,payment_number,transaction_id,items_json,subtotal,delivery_charge,total,payment_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(orderId, signedInCustomer?.id || null, customer, phone, address, text(b.note, 500), methodName, payNumber || "", txid, JSON.stringify(cleanItems), subtotal, delivery, total, methodName === "cod" ? "unpaid" : "submitted"),
          ...cleanItems.map(it => env.DB.prepare("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?").bind(it.qty, it.id, it.qty))
        ];
        await env.DB.batch(statements);
        return json({ ok: true, order_id: orderId, total });
      }

      // Customer registration, login and account endpoints (independent of admin auth).
      if (path === "/api/customer/register" && method === "POST") {
        const b = await body(request);
        const name = text(b.name, 100), phone = text(b.phone, 30), address = text(b.address, 500), password = String(b.password || "");
        if (!name || !/^\+?[0-9\s()-]{8,20}$/.test(phone) || password.length < 8 || password.length > 128)
          return json({ error: "নাম, সঠিক ফোন নম্বর এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।" }, 400);
        const exists = await env.DB.prepare("SELECT id FROM customers WHERE phone=?").bind(phone).first();
        if (exists) return json({ error: "এই ফোন নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। লগইন করুন।" }, 409);
        const customerId = id(), salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await passwordHash(password, salt);
        await env.DB.prepare("INSERT INTO customers(id,name,phone,address,password_hash,password_salt) VALUES(?,?,?,?,?,?)")
          .bind(customerId, name, phone, address, hash, salt).run();
        const token = await newCustomerSession(env.DB, customerId);
        return new Response(JSON.stringify({ ok: true, customer: { id: customerId, name, phone, address } }), {
          headers: { ...corsHeaders, "Set-Cookie": customerCookie(token, 2592000) }
        });
      }
      if (path === "/api/customer/login" && method === "POST") {
        const b = await body(request), phone = text(b.phone, 30), password = String(b.password || "");
        const customer = await env.DB.prepare("SELECT id,name,phone,address,password_hash,password_salt FROM customers WHERE phone=?").bind(phone).first();
        if (!customer || !password || await passwordHash(password, customer.password_salt) !== customer.password_hash)
          return json({ error: "ফোন নম্বর অথবা পাসওয়ার্ড সঠিক নয়।" }, 401);
        const token = await newCustomerSession(env.DB, customer.id);
        return new Response(JSON.stringify({ ok: true, customer: { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address } }), {
          headers: { ...corsHeaders, "Set-Cookie": customerCookie(token, 2592000) }
        });
      }
      if (path === "/api/customer/logout" && method === "POST") {
        const raw = request.headers.get("Cookie") || "";
        const token = raw.split(";").map(x => x.trim()).find(x => x.startsWith("toto_customer="))?.slice(14);
        if (token) await env.DB.prepare("DELETE FROM customer_sessions WHERE token_hash=?").bind(await tokenDigest(token)).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Set-Cookie": customerCookie("", 0) } });
      }
      if (path === "/api/customer/me" && method === "GET") {
        const customer = await currentCustomer(request, env);
        return customer ? json({ customer }) : json({ error: "লগইন করুন।" }, 401);
      }
      if (path === "/api/customer/orders" && method === "GET") {
        const customer = await currentCustomer(request, env);
        if (!customer) return json({ error: "লগইন করুন।" }, 401);
        const { results } = await env.DB.prepare(`SELECT id,customer_name,phone,address,items_json,subtotal,delivery_charge,total,status,payment_status,created_at
          FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100`).bind(customer.id).all();
        return json({ orders: (results || []).map(o => ({ ...o, items: JSON.parse(o.items_json || "[]") })) });
      }

      if (path === "/api/track" && method === "POST") {
        const b = await body(request);
        const order = await env.DB.prepare("SELECT id,status,payment_status,total,created_at FROM orders WHERE id=? AND phone=?")
          .bind(text(b.order_id, 100), text(b.phone, 30)).first();
        return order ? json({ order }) : json({ error: "অর্ডার পাওয়া যায়নি। অর্ডার নম্বর ও ফোন নম্বর মিলিয়ে দেখুন।" }, 404);
      }

      if (path === "/api/admin/login" && method === "POST") {
        const b = await body(request);
        if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "সার্ভার সিক্রেট সেটআপ করা হয়নি।" }, 503);
        if (text(b.password, 200) !== env.ADMIN_PASSWORD) return json({ error: "পাসওয়ার্ড সঠিক নয়।" }, 401);
        const token = await makeSession(env.SESSION_SECRET);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Set-Cookie": cookie(token, 28800) }
        });
      }
      if (path === "/api/admin/logout" && method === "POST") {
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Set-Cookie": cookie("", 0) } });
      }
      if (path.startsWith("/api/admin/")) {
        if (!(await requireAdmin(request, env))) return json({ error: "অনুমতি নেই। আবার লগইন করুন।" }, 401);

        if (path === "/api/admin/me" && method === "GET") return json({ ok: true });

        if (path === "/api/admin/products" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
          return json({ products: results || [] });
        }
        if (path === "/api/admin/products" && method === "POST") {
          const b = await body(request), pid = text(b.id, 80) || id();
          const name = text(b.name, 150);
          if (!name) return json({ error: "পণ্যের নাম দিন।" }, 400);
          await env.DB.prepare(`INSERT INTO products(id,name,category,description,price,old_price,image_url,stock,active)
            VALUES(?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,
            price=excluded.price,old_price=excluded.old_price,image_url=excluded.image_url,stock=excluded.stock,active=excluded.active`)
            .bind(pid, name, text(b.category,80) || "অন্যান্য", text(b.description,1000), money(b.price),
              b.old_price === "" || b.old_price == null ? null : money(b.old_price), text(b.image_url,1000),
              Math.max(0, Math.floor(Number(b.stock)||0)), b.active === false ? 0 : 1).run();
          return json({ ok: true });
        }
        const deleteMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
        if (deleteMatch && method === "DELETE") {
          await env.DB.prepare("DELETE FROM products WHERE id=?").bind(decodeURIComponent(deleteMatch[1])).run();
          return json({ ok: true });
        }
        if (path === "/api/admin/orders" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 300").all();
          return json({ orders: (results || []).map(o => ({ ...o, items: JSON.parse(o.items_json || "[]") })) });
        }
        const orderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
        if (orderMatch && method === "PATCH") {
          const b = await body(request);
          const statuses = ["pending","confirmed","processing","shipped","delivered","cancelled"];
          const payStatuses = ["unpaid","submitted","paid","rejected"];
          if (!statuses.includes(b.status) || !payStatuses.includes(b.payment_status)) return json({ error: "স্ট্যাটাস সঠিক নয়।" }, 400);
          await env.DB.prepare("UPDATE orders SET status=?,payment_status=? WHERE id=?")
            .bind(b.status, b.payment_status, decodeURIComponent(orderMatch[1])).run();
          return json({ ok: true });
        }
        if (path === "/api/admin/settings" && method === "GET") return json({ settings: await allSettings(env.DB) });
        if (path === "/api/admin/settings" && method === "POST") {
          const b = await body(request);
          const allowed = ["shop_name","tagline","announcement","bkash_number","nagad_number","telegram_url","whatsapp_url",
            "delivery_charge","cod_enabled","bkash_enabled","nagad_enabled","hero_title","hero_subtitle"];
          const stmts = [];
          for (const key of allowed) if (b[key] !== undefined) {
            const value = ["cod_enabled","bkash_enabled","nagad_enabled"].includes(key) ? (b[key] ? "1" : "0") : text(b[key], 1000);
            stmts.push(env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,value));
          }
          if (stmts.length) await env.DB.batch(stmts);
          return json({ ok: true });
        }
      }
      return json({ error: "পাওয়া যায়নি।" }, 404);
    } catch (e) {
      return json({ error: "সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।" }, 500);
    }
  }
};
