const BASE_URL = "https://api.everrest.educata.dev";
const SHOP_URL = BASE_URL + "/shop";

async function refreshAccessToken() {
  try {
    const rt = localStorage.getItem("refresh_token");
    if (!rt) return null;
    const r = await fetch(BASE_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.access_token) { localStorage.setItem("access_token", d.access_token); return d.access_token; }
    return null;
  } catch (e) { return null; }
}

async function authFetch(url, options) {
  options.headers = options.headers || {};
  options.headers["Authorization"] = "Bearer " + localStorage.getItem("access_token");
  let response = await fetch(url, options);
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      options.headers["Authorization"] = "Bearer " + newToken;
      response = await fetch(url, options);
    } else { doSignOut(); }
  }
  return response;
}

window.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("access_token");
  if (!token) { window.location.href = "signin.html"; return; }

  document.getElementById("btn-signout").addEventListener("click", doSignOut);
  document.getElementById("btn-back").addEventListener("click", function () { window.location.href = "shop.html"; });
  document.getElementById("btn-shop").addEventListener("click", function () { window.location.href = "shop.html"; });
  document.getElementById("btn-profile").addEventListener("click", function () { window.location.href = "profile.html"; });
  document.getElementById("btn-logo").addEventListener("click", function () { window.location.href = "shop.html"; });
  document.getElementById("d-btn").addEventListener("click", addToCartFromPage);

  // Cart
  document.getElementById("btn-cart").addEventListener("click", toggleCart);
  document.getElementById("btn-cart-close").addEventListener("click", toggleCart);
  document.getElementById("cart-overlay").addEventListener("click", toggleCart);
  document.getElementById("btn-checkout").addEventListener("click", doCheckout);
  loadCart();

  initRatings();

  // Mobile burger menu
  const burgerBtn = document.getElementById("burger-btn");
  const mobileNav = document.getElementById("mobile-nav");
  burgerBtn.addEventListener("click", function () {
    const open = mobileNav.classList.toggle("open");
    burgerBtn.classList.toggle("open", open);
  });
  document.getElementById("m-btn-shop").addEventListener("click", function () { window.location.href = "shop.html"; });
  document.getElementById("m-btn-profile").addEventListener("click", function () { window.location.href = "profile.html"; });
  document.getElementById("m-btn-signout").addEventListener("click", doSignOut);
  const mCartBtn = document.getElementById("m-btn-cart");
  if (mCartBtn) mCartBtn.addEventListener("click", function () {
    mobileNav.classList.remove("open");
    burgerBtn.classList.remove("open");
    toggleCart();
  });

  const params    = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  if (!productId) { window.location.href = "shop.html"; return; }

  try {
    const saved = localStorage.getItem("selected_product");
    if (saved) {
      const p = JSON.parse(saved);
      if (p._id === productId) { renderProduct(p); return; }
    }
  } catch (e) {}

  loadProduct(productId);
});

function doSignOut() {
  try {
    fetch(BASE_URL + "/auth/sign_out", {
      method: "POST",
      headers: { "Authorization": "Bearer " + localStorage.getItem("access_token") },
    }).catch(function () {});
  } catch (e) {}
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "signin.html";
}

async function loadProduct(productId) {
  try {
    const endpoints = [
      SHOP_URL + "/products/product/" + productId,
      SHOP_URL + "/products/" + productId,
    ];
    let p = null;
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const response = await authFetch(endpoints[i], {});
        if (response.ok) { p = await response.json(); break; }
      } catch (e) {}
    }
    if (!p) {
      document.getElementById("product-content").innerHTML =
        "<p style='color:var(--error);padding:20px;'>პროდუქტი ვერ მოიძებნა</p>";
      return;
    }
    renderProduct(p);
  } catch (err) {
    document.getElementById("product-content").innerHTML =
      "<p style='color:var(--error);padding:20px;'>შეცდომა: " + err.message + "</p>";
  }
}

function renderProduct(p) {
  try {
    const amount  = typeof p.stock !== "undefined" ? p.stock : (typeof p.amount !== "undefined" ? p.amount : 0);
    const inStock = amount > 0;

    let image = "";
    if (p.thumbnail) image = p.thumbnail;
    else if (p.image) image = p.image;
    else if (Array.isArray(p.images) && p.images.length > 0) {
      image = typeof p.images[0] === "string" ? p.images[0] : (p.images[0] && p.images[0].url ? p.images[0].url : "");
    }

    let catName = "";
    if (p.category) catName = typeof p.category === "object" ? (p.category.name || "") : p.category;

    let price = 0;
    if (typeof p.price === "number") price = p.price;
    else if (typeof p.price === "object" && p.price)
      price = p.price.current ?? p.price.amount ?? p.price.value ?? Object.values(p.price)[0] ?? 0;

    document.title = (p.title || p.name || "პროდუქტი") + " — EverREST";

    const imgEl = document.getElementById("d-image");
    imgEl.removeAttribute("crossorigin");
    imgEl.src = image || "https://placehold.co/600x500/1e1e2a/6b6b80?text=No+Image";
    imgEl.onerror = function () { imgEl.src = "https://placehold.co/600x500/1e1e2a/6b6b80?text=No+Image"; };

    document.getElementById("d-title").textContent       = p.title || p.name || "პროდუქტი";
    document.getElementById("d-price").textContent       = "$" + Number(price).toFixed(2);
    document.getElementById("d-description").textContent = p.description || "აღწერა არ არის";
    if (catName) document.getElementById("d-category").textContent = catName;

    const stockEl = document.getElementById("d-stock");
    if (inStock) { stockEl.textContent = "✔ " + amount + " მარაგში"; stockEl.className = "amount-badge in-stock"; }
    else         { stockEl.textContent = "✖ ამოწურულია";              stockEl.className = "amount-badge out-of-stock"; }

    const btn = document.getElementById("d-btn");
    if (!inStock) { btn.disabled = true; btn.textContent = "ამოწურულია"; btn.style.opacity = "0.5"; }
    else          { btn.disabled = false; btn.textContent = "+ კალათაში დამატება"; btn.style.opacity = ""; }

    window.currentProductId = (typeof p._id === "object" && p._id !== null) ? (p._id.$oid || p._id._id || String(p._id)) : (p._id || p.id || "");
    renderRatingDisplay(p);
  } catch (err) { console.error("renderProduct:", err); }
}

async function addToCartFromPage() {
  const productId = window.currentProductId;
  if (!productId) { showAlert("error", "პროდუქტის ID ვერ მოიძებნა"); return; }

  const btn = document.getElementById("d-btn");
  btn.disabled = true; btn.textContent = "ემატება...";

  try {
    await addToCartAndShow(productId);
    // კალათის drawer გახსნა დამატების შემდეგ
    const drawer = document.getElementById("cart-drawer");
    if (!drawer.classList.contains("open")) toggleCart();
  } catch (err) {
    showAlert("error", "კავშირის შეცდომა: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "+ კალათაში დამატება";
  }
}

function showAlert(type, message) {
  try {
    const alertBox = document.getElementById("d-alert");
    alertBox.innerHTML = `<div class="alert ${type}"><span>${type === "success" ? "✅" : "❌"}</span><span>${message}</span></div>`;
    setTimeout(function () { alertBox.innerHTML = ""; }, 3500);
  } catch (e) {}
}

// ─────────────────────────────────────────
//  RATINGS
// ─────────────────────────────────────────

let selectedRating = 0;

function initRatings() {
  const stars = document.querySelectorAll("#star-picker .star");

  stars.forEach(function (star) {
    star.addEventListener("mouseenter", function () {
      const val = parseInt(this.dataset.value);
      stars.forEach(function (s) {
        s.classList.toggle("hover", parseInt(s.dataset.value) <= val);
      });
    });
    star.addEventListener("mouseleave", function () {
      stars.forEach(function (s) { s.classList.remove("hover"); });
    });
    star.addEventListener("click", function () {
      selectedRating = parseInt(this.dataset.value);
      stars.forEach(function (s) {
        s.classList.toggle("active", parseInt(s.dataset.value) <= selectedRating);
      });
    });
  });

  document.getElementById("btn-submit-rate").addEventListener("click", submitRating);
}

function renderRatingDisplay(p) {
  const el = document.getElementById("rating-display");
  if (!el) return;

  // product object-იდან rating ველები
  const ratingObj  = p.rating || {};
  const score      = typeof p.rating === "number" ? p.rating
                   : (ratingObj.average ?? ratingObj.avg ?? ratingObj.score ?? ratingObj.rate ?? null);
  const total      = ratingObj.count ?? ratingObj.total ?? ratingObj.votes ?? null;
  const breakdown  = ratingObj.breakdown || ratingObj.distribution || null; // {1:n, 2:n, ...}

  if (score === null) {
    el.innerHTML = '<div class="reviews-empty" style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px;text-align:center;color:var(--muted);font-size:14px;">შეფასებები ჯერ არ არის</div>';
    return;
  }

  const displayScore = Number(score).toFixed(1);

  // stars html
  let starsHtml = "";
  for (let i = 1; i <= 5; i++) {
    starsHtml += `<span class="s${i <= Math.round(score) ? " filled" : ""}">★</span>`;
  }

  // breakdown bars (თუ API აბრუნებს)
  let barsHtml = "";
  if (breakdown && total) {
    barsHtml = '<div class="rating-bars">';
    for (let i = 5; i >= 1; i--) {
      const cnt = breakdown[i] || breakdown[String(i)] || 0;
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      barsHtml += `
        <div class="bar-row">
          <div class="bar-label">${i}<span class="s">★</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div class="bar-count">${cnt}</div>
        </div>`;
    }
    barsHtml += '</div>';
  }

  el.innerHTML = `
    <div class="rating-big-card">
      <div class="rating-score">${displayScore}</div>
      <div class="rating-info">
        <div class="rating-stars-row">${starsHtml}</div>
        ${total !== null
          ? `<div class="rating-count-text"><strong>${total}</strong> შეფასება</div>`
          : '<div class="rating-count-text">შეფასებული</div>'}
      </div>
    </div>
    ${barsHtml}`;
}

async function submitRating() {
  const alertEl = document.getElementById("rate-alert");

  if (!selectedRating) {
    alertEl.innerHTML = '<div class="alert error"><span>❌</span><span>გთხოვთ შეარჩიოთ ვარსკვლავები</span></div>';
    return;
  }

  const productId = window.currentProductId;
  if (!productId) {
    alertEl.innerHTML = '<div class="alert error"><span>❌</span><span>პროდუქტის ID ვერ მოიძებნა</span></div>';
    return;
  }

  const btn = document.getElementById("btn-submit-rate");
  btn.disabled = true;
  btn.textContent = "იგზავნება...";
  alertEl.innerHTML = "";

  try {
    const response = await authFetch(SHOP_URL + "/products/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: productId, rate: selectedRating }),
    });

    const data = await response.json().catch(function () { return {}; });

    if (response.ok) {
      alertEl.innerHTML = '<div class="alert success"><span>✅</span><span>შეფასება წარმატებით გაიგზავნა!</span></div>';
      // განახლებული product-ი პასუხში მოდის — rating-ს გადავცემთ render-ს
      if (data && (data.rating !== undefined || data._id)) {
        renderRatingDisplay(data);
      }
      // ვარსკვლავები reset (optional — შეიძლება დაოყენდეს)
      setTimeout(function () { alertEl.innerHTML = ""; }, 4000);
    } else {
      alertEl.innerHTML = `<div class="alert error"><span>❌</span><span>${data.message || data.error || "შეცდომა"}</span></div>`;
    }
  } catch (e) {
    alertEl.innerHTML = '<div class="alert error"><span>❌</span><span>კავშირის შეცდომა</span></div>';
  } finally {
    btn.disabled = false;
    btn.textContent = "შეფასების გაგზავნა";
  }
}

/* ═══════════════════════════════════════════
   CART — HELPERS + FULL LOGIC
═══════════════════════════════════════════ */

function getPrice(p) {
  if (typeof p === "number") return p;
  if (typeof p === "object" && p) return p.current ?? p.amount ?? p.value ?? Object.values(p)[0] ?? 0;
  return 0;
}
function extractId(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") return raw.$oid || raw._id || raw.id || String(raw);
  return String(raw);
}
function getImageUrl(p) {
  if (p.thumbnail && typeof p.thumbnail === "string") return p.thumbnail;
  if (p.image && typeof p.image === "string") return p.image;
  if (Array.isArray(p.images) && p.images.length > 0) {
    return typeof p.images[0] === "string" ? p.images[0] : (p.images[0] && p.images[0].url ? p.images[0].url : "");
  }
  return "";
}
function setImgSrc(imgEl, url) {
  if (!url) { imgEl.src = "https://placehold.co/400x300/1e1e2a/6b6b80?text=No+Image"; return; }
  imgEl.onerror = function () { imgEl.onerror = null; imgEl.src = "https://placehold.co/400x300/1e1e2a/6b6b80?text=No+Image"; };
  imgEl.src = url;
}

function toggleCart() {
  document.getElementById("cart-drawer").classList.toggle("open");
  document.getElementById("cart-overlay").classList.toggle("open");
}

async function loadCart() {
  try {
    const response = await authFetch(SHOP_URL + "/cart", {});
    if (!response.ok) { renderCart({ products: [], total: { quantity: 0, price: 0 } }); return; }
    renderCart(await response.json());
  } catch (err) { renderCart({ products: [], total: { quantity: 0, price: 0 } }); }
}

async function addToCartAndShow(productId) {
  try {
    let response = await authFetch(SHOP_URL + "/cart/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, quantity: 1 }),
    });
    if (!response.ok && response.status === 400) {
      response = await authFetch(SHOP_URL + "/cart/product", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, quantity: 1 }),
      });
    }
    if (response.ok) {
      renderCart(await response.json());
      showToast("✅ პროდუქტი კალათაში დაემატა!", "success");
    } else {
      const e = await response.json().catch(function () { return {}; });
      showToast("❌ " + (e.error || e.message || "შეცდომა"), "error");
    }
  } catch (err) { showToast("❌ კავშირის შეცდომა", "error"); }
}

async function updateCartQuantity(productId, newQty) {
  try {
    if (newQty < 1) { await removeFromCart(productId); return; }
    const response = await authFetch(SHOP_URL + "/cart/product", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, quantity: newQty }),
    });
    if (response.ok) { renderCart(await response.json()); }
  } catch (err) { console.error("updateCartQuantity:", err); }
}

async function removeFromCart(productId) {
  try {
    const response = await authFetch(SHOP_URL + "/cart/product", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId }),
    });
    if (response.ok) { renderCart(await response.json()); }
  } catch (err) { console.error("removeFromCart:", err); }
}

async function doCheckout() {
  try {
    const response = await authFetch(SHOP_URL + "/cart/checkout", { method: "POST" });
    if (!response.ok) {
      const e = await response.json().catch(function () { return {}; });
      showToast("❌ " + (e.message || "შეკვეთა ვერ განხორციელდა"), "error"); return;
    }
    await loadCart();
    showToast("✅ შეკვეთა წარმატებით განხორციელდა!", "success");
  } catch (err) { showToast("❌ " + err.message, "error"); }
}

function renderCart(cartData) {
  const products   = cartData.products || [];
  const totalObj   = cartData.total    || {};
  const totalQty   = totalObj.quantity || products.reduce(function (s, p) { return s + (p.quantity || 1); }, 0);
  const totalPrice = typeof totalObj.price === "number" ? totalObj.price : (getPrice(totalObj.price) || 0);

  document.getElementById("cart-count").textContent = totalQty;
  const mBadge = document.getElementById("m-cart-count");
  if (mBadge) mBadge.textContent = totalQty;

  const itemsEl = document.getElementById("cart-items");
  const footer  = document.getElementById("cart-footer");

  if (products.length === 0) {
    itemsEl.innerHTML    = '<div class="cart-empty">🛒 კალათა ცარიელია</div>';
    footer.style.display = "none";
    return;
  }

  itemsEl.innerHTML = "";
  products.forEach(function (item) {
    const id        = extractId(item.productId || item._id || item.id);
    const qty       = item.quantity || 1;
    const unitPrice = item.pricePerQuantity || getPrice(item.price) || 0;
    const sub       = (Number(unitPrice) * qty).toFixed(2);
    const title     = item.title || item.name || ("პროდუქტი #" + String(id).slice(-6));
    const img       = getImageUrl(item) || "https://placehold.co/50x50/1e1e2a/6b6b80?text=📦";

    const el = document.createElement("div");
    el.className = "cart-item";
    el.innerHTML =
      '<img class="cart-item-img" alt="' + title + '">' +
      '<div class="cart-item-info">' +
        '<div class="cart-item-title">' + title + '</div>' +
        '<div class="cart-item-price">$' + sub +
          ' <span style="color:var(--muted);font-size:11px">(1 ც. = $' + Number(unitPrice).toFixed(2) + ')</span>' +
        '</div>' +
      '</div>' +
      '<div class="cart-item-qty">' +
        '<button class="qty-btn qty-minus">−</button>' +
        '<span class="qty-val">' + qty + '</span>' +
        '<button class="qty-btn qty-plus">+</button>' +
      '</div>' +
      '<button class="cart-item-remove" title="წაშლა">🗑</button>';

    setImgSrc(el.querySelector(".cart-item-img"), img);
    el.querySelector(".qty-minus").addEventListener("click", function () { updateCartQuantity(id, qty - 1); });
    el.querySelector(".qty-plus").addEventListener("click", function () { updateCartQuantity(id, qty + 1); });
    el.querySelector(".cart-item-remove").addEventListener("click", function () { removeFromCart(id); });
    itemsEl.appendChild(el);
  });

  document.getElementById("cart-total").textContent = "$" + Number(totalPrice).toFixed(2);
  footer.style.display = "block";
}

function showToast(message, type) {
  let t = document.getElementById("product-toast");
  if (!t) {
    t = document.createElement("div"); t.id = "product-toast";
    t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;font-size:13px;z-index:9999;opacity:0;transition:all 0.3s ease;pointer-events:none;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,0.4);";
    document.body.appendChild(t);
  }
  t.textContent       = message;
  t.style.color       = type === "success" ? "var(--success)" : "var(--error)";
  t.style.borderColor = type === "success" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)";
  t.style.opacity     = "1";
  t.style.transform   = "translateX(-50%) translateY(0)";
  setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(20px)"; }, 3000);
}
