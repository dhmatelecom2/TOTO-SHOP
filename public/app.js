const $ = s => document.querySelector(s);
const fmt = n => "৳" + Number(n || 0).toLocaleString("bn-BD");
let products = [], settings = {}, cart = [];
const api = async (path, opts={}) => {
  const r = await fetch(path,{headers:{"Content-Type":"application/json"},...opts});
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || "কিছু একটা সমস্যা হয়েছে");
  return data;
};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300)}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function init(){
  $("#year").textContent=new Date().getFullYear();
  try{
    const [p,s]=await Promise.all([api("/api/products"),api("/api/settings")]);
    products=p.products;settings=s;
    $("#shopName").textContent=s.shop_name;document.title=s.shop_name+" | Online Store";
    $("#announcement").textContent=s.announcement;$("#heroTitle").innerHTML=safe(s.hero_title).replace(/\n/g,"<br>");
    $("#heroSubtitle").textContent=s.hero_subtitle;
    $("#supportLinks").innerHTML=(s.telegram_url?`<a target="_blank" rel="noopener" href="${safe(s.telegram_url)}">↗ Telegram Support</a>`:"")+(s.whatsapp_url?`<a target="_blank" rel="noopener" href="${safe(s.whatsapp_url)}">↗ WhatsApp Support</a>`:"");
    renderProducts();
  }catch(e){$("#productGrid").innerHTML='<div class="empty">ওয়েবসাইটের ডাটাবেজ এখনো সেটআপ হয়নি। অ্যাডমিন/ডিপ্লয়মেন্ট নির্দেশনা দেখুন।</div>'}
}
function renderProducts(){
 const q=$("#search").value.toLowerCase();
 const list=products.filter(p=>(p.name+" "+p.category+" "+p.description).toLowerCase().includes(q));
 $("#productGrid").innerHTML=list.length?list.map(p=>`<article class="product-card"><div class="product-image">${p.image_url?`<img src="${safe(p.image_url)}" alt="${safe(p.name)}" loading="lazy">`:`<span class="product-placeholder">T.</span>`}<span class="stock-tag">${p.stock>0?"স্টকে আছে":"স্টক শেষ"}</span></div><div class="product-info"><span class="product-category">${safe(p.category)}</span><h3>${safe(p.name)}</h3><div class="product-desc">${safe(p.description)}</div><div class="price-row"><b>${fmt(p.price)}</b>${p.old_price?`<span class="old-price">${fmt(p.old_price)}</span>`:""}</div><button class="add-btn" ${p.stock<1?"disabled":""} onclick="addToCart('${p.id}')">${p.stock>0?"কার্টে যোগ করুন":"স্টক শেষ"}</button></div></article>`).join(""):'<div class="empty">কোনো পণ্য পাওয়া যায়নি।</div>';
}
$("#search").addEventListener("input",renderProducts);
function addToCart(pid){const p=products.find(x=>x.id===pid);if(!p)return;let item=cart.find(x=>x.id===pid);if(item){if(item.qty>=p.stock)return toast("স্টকের বেশি নেওয়া যাবে না");item.qty++}else cart.push({id:pid,qty:1});renderCart();toast("কার্টে যোগ হয়েছে")}
function renderCart(){
 $("#cartCount").textContent=cart.reduce((a,x)=>a+x.qty,0);
 $("#cartItems").innerHTML=cart.length?cart.map(x=>{const p=products.find(y=>y.id===x.id);return p?`<div class="cart-item"><div><b>${safe(p.name)}</b><small>${fmt(p.price)} × ${x.qty}</small></div><div class="qty-controls"><button onclick="changeQty('${x.id}',-1)">−</button>${x.qty}<button onclick="changeQty('${x.id}',1)">+</button></div></div>`:""}).join(""):'<div class="empty">আপনার কার্ট এখনো খালি।</div>';
 const total=cart.reduce((a,x)=>a+(products.find(p=>p.id===x.id)?.price||0)*x.qty,0);
 $("#cartTotal").textContent=fmt(total);$("#checkoutTotal").textContent=fmt(total+(settings.delivery_charge||0));
}
function changeQty(pid,d){const x=cart.find(i=>i.id===pid),p=products.find(i=>i.id===pid);if(!x)return;x.qty+=d;if(x.qty<1)cart=cart.filter(i=>i.id!==pid);if(p&&x.qty>p.stock)x.qty=p.stock;renderCart()}
function drawer(open){$("#cartDrawer").classList.toggle("open",open);$("#overlay").classList.toggle("show",open)}
$("#cartOpen").onclick=()=>drawer(true);$("#cartClose").onclick=()=>drawer(false);$("#overlay").onclick=()=>drawer(false);
$("#checkoutOpen").onclick=()=>{if(!cart.length)return toast("আগে পণ্য কার্টে যোগ করুন");drawer(false);openCheckout()};
$("#checkoutClose").onclick=()=>$("#checkoutModal").classList.remove("show");
function openCheckout(){
 const choices=[];if(settings.cod_enabled)choices.push(["cod","ক্যাশ অন ডেলিভারি"]);if(settings.bkash_enabled)choices.push(["bkash","বিকাশ"]);if(settings.nagad_enabled)choices.push(["nagad","নগদ"]);
 $("#paymentChoices").innerHTML=choices.map((x,i)=>`<label class="payment-option ${i===0?"selected":""}"><input type="radio" name="payment_method" value="${x[0]}" ${i===0?"checked":""}>${x[1]}</label>`).join("");
 $("#paymentChoices").querySelectorAll("label").forEach(l=>l.onclick=()=>{document.querySelectorAll(".payment-option").forEach(x=>x.classList.remove("selected"));l.classList.add("selected");l.querySelector("input").checked=true;renderPaymentDetail()});
 $("#checkoutMessage").textContent="";$("#checkoutModal").classList.add("show");renderPaymentDetail();renderCart();
}
function renderPaymentDetail(){
 const method=document.querySelector('input[name="payment_method"]:checked')?.value;
 if(method==="bkash"||method==="nagad"){
  const number=method==="bkash"?settings.bkash_number:settings.nagad_number;
  $("#paymentDetails").innerHTML=`<div class="payment-detail">এই নম্বরে ${method==="bkash"?"বিকাশ":"নগদ"}-এ টাকা পাঠান: <b>${safe(number||"অ্যাডমিনের সঙ্গে যোগাযোগ করুন")}</b><br>পেমেন্ট করার পর নিচে Transaction ID লিখুন।<input name="transaction_id" id="transactionId" placeholder="Transaction ID" required></div>`;
 }else $("#paymentDetails").innerHTML='<div class="payment-detail">পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিন।</div>';
}
$("#checkoutForm").onsubmit=async e=>{
 e.preventDefault();if(!cart.length)return;
 const f=new FormData(e.target),method=f.get("payment_method");
 const payload={customer_name:f.get("customer_name"),phone:f.get("phone"),address:f.get("address"),note:f.get("note"),payment_method:method,transaction_id:f.get("transaction_id")||"",items:cart};
 const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="অর্ডার পাঠানো হচ্ছে...";
 try{const r=await api("/api/orders",{method:"POST",body:JSON.stringify(payload)});cart=[];renderCart();e.target.reset();$("#checkoutMessage").innerHTML=`অর্ডার সফল হয়েছে!<br>আপনার অর্ডার নম্বর: <b>${safe(r.order_id)}</b><br>মোট: <b>${fmt(r.total)}</b><br>এই নম্বরটি সংরক্ষণ করুন।`;toast("অর্ডার গ্রহণ করা হয়েছে");}
 catch(err){$("#checkoutMessage").textContent=err.message}
 finally{btn.disabled=false;btn.textContent="অর্ডার কনফার্ম করুন"}
};
$("#trackForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);$("#trackResult").textContent="খোঁজা হচ্ছে...";try{const r=await api("/api/track",{method:"POST",body:JSON.stringify({order_id:f.get("order_id"),phone:f.get("phone")})});const labels={pending:"অপেক্ষমাণ",confirmed:"নিশ্চিত",processing:"প্রস্তুত হচ্ছে",shipped:"পথে আছে",delivered:"ডেলিভারি সম্পন্ন",cancelled:"বাতিল"};$("#trackResult").textContent=`অর্ডার ${r.order.id}: ${labels[r.order.status]||r.order.status} · ${fmt(r.order.total)}`}catch(err){$("#trackResult").textContent=err.message}};
init();renderCart();
