const BASE_URL  = "https://api.everrest.educata.dev";
const SHOP_URL  = BASE_URL + "/shop";
const PAGE_SIZE = 12;

let currentPage       = 1;
let totalPages        = 1;
let debounceTimer     = null;
let allLoadedProducts = [];

window.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("access_token");
  if (!token) { window.location.href = "signin.html"; return; }

  document.getElementById("btn-signout").addEventListener("click", doSignOut);
  document.getElementById("btn-profile").addEventListener("click", function () { window.location.href = "profile.html"; });

  const cartBtn = document.getElementById("btn-cart");
  if (cartBtn) cartBtn.addEventListener("click", toggleCart);

  // Mobile burger menu
  const burgerBtn = document.getElementById("burger-btn");
  const mobileNav = document.getElementById("mobile-nav");
  burgerBtn.addEventListener("click", function () {
    const open = mobileNav.classList.toggle("open");
    burgerBtn.classList.toggle("open", open);
  });
  document.getElementById("m-btn-profile").addEventListener("click", function () { window.location.href = "profile.html"; });
  document.getElementById("m-btn-shop").addEventListener("click", function () {
    mobileNav.classList.remove("open");
    burgerBtn.classList.remove("open");
  });
  document.getElementById("m-btn-signout").addEventListener("click", doSignOut);
  const mCartBtn = document.getElementById("m-btn-cart");
  if (mCartBtn) mCartBtn.addEventListener("click", function () {
    mobileNav.classList.remove("open");
    burgerBtn.classList.remove("open");
    toggleCart();
  });

  document.getElementById("btn-cart-close").addEventListener("click", toggleCart);
  document.getElementById("cart-overlay").addEventListener("click", toggleCart);
  document.getElementById("btn-reset").addEventListener("click", resetFilters);
  document.getElementById("btn-checkout").addEventListener("click", doCheckout);

  document.getElementById("f-search").addEventListener("input", debounceLoad);
  document.getElementById("f-category").addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); renderPagination(); });
  document.getElementById("f-price-min").addEventListener("input", debounceLoad);
  document.getElementById("f-price-max").addEventListener("input", debounceLoad);
  document.getElementById("f-sort").addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); renderPagination(); });

  loadCategories();
  loadProducts(true);
  loadCart();
});

async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;
    const response = await fetch(BASE_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      return data.access_token;
    }
    return null;
  } catch (e) { return null; }
}

async function authFetch(url, options) {
  let token = localStorage.getItem("access_token");
  options.headers = options.headers || {};
  options.headers["Authorization"] = "Bearer " + token;
  let response = await fetch(url, options);
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      options.headers["Authorization"] = "Bearer " + newToken;
      response = await fetch(url, options);
    } else {
      doSignOut(); return response;
    }
  }
  return response;
}

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

async function loadCategories() {
  try {
    // API კატეგორიები
    const response = await authFetch(SHOP_URL + "/products/categories", {});
    const select = document.getElementById("f-category");
    if (response.ok) {
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.categories || []);
      list.forEach(function (cat) {
        const opt = document.createElement("option");
        const name = typeof cat === "object" ? (cat.name || cat._id) : cat;
        opt.value = name.toLowerCase();
        opt.textContent = name;
        select.appendChild(opt);
      });
    }
  } catch (err) { console.error("კატეგორიები:", err); }
}
let lastFetchParams = {};

let allProductsCache = [];
let cacheLoaded = false;

async function ensureCache() {
  if (cacheLoaded) return true;
  try {
    const p1 = new URLSearchParams();
    p1.set("page_index", 1);
    p1.set("page_size", 20);
    const r1 = await authFetch(SHOP_URL + "/products/all?" + p1, {});
    if (!r1.ok) {
      const e = await r1.json().catch(function(){return{};});
      console.error("products/all error:", e);
      return false;
    }
    const d1    = await r1.json();
    const first = Array.isArray(d1) ? d1 : (d1.products || []);
    const total = d1.total || d1.totalCount || d1.total_products || first.length;
    const limit = d1.limit || d1.page_size || 20;

    const pages = Math.ceil(total / limit);
    let all = first.slice();

    for (let i = 2; i <= pages; i++) {
      const p = new URLSearchParams();
      p.set("page_index", i);
      p.set("page_size", limit);
      try {
        const r = await authFetch(SHOP_URL + "/products/all?" + p, {});
        if (!r.ok) break;
        const d = await r.json();
        const products = Array.isArray(d) ? d : (d.products || []);
        all = all.concat(products);
      } catch(e) { break; }
    }

    allProductsCache = all;
    cacheLoaded = true;
    console.log("Cache loaded:", all.length, "products, total:", total);

    return true;
  } catch (err) {
    console.error("ensureCache:", err);
    return false;
  }
}

async function loadProducts(resetPage) {
  try {
    if (resetPage) currentPage = 1;
    showSkeletons();

    const ok = await ensureCache();
    if (!ok) { showError("პროდუქტები ვერ ჩაიტვირთა"); return; }

    applyFiltersAndRender();
  } catch (err) { console.error("პროდუქტები:", err); showError(err.message); }
}

function applyFiltersAndRender() {
  const search   = document.getElementById("f-search").value.trim().toLowerCase();
  const category = document.getElementById("f-category").value.trim().toLowerCase();
  const priceMin = parseFloat(document.getElementById("f-price-min").value) || 0;
  const priceMax = parseFloat(document.getElementById("f-price-max").value) || Infinity;

  let filtered = allProductsCache.filter(function (p) {
    const title   = (p.title || p.name || "").toLowerCase();
    const desc    = (p.description || "").toLowerCase();
    const catName = getCategoryName(p).toLowerCase();
    const price   = getPrice(p.price);

    if (search   && !title.includes(search) && !desc.includes(search)) return false;
    if (category && catName !== category) return false;
    if (price < priceMin) return false;
    if (price > priceMax) return false;
    return true;
  });

  document.getElementById("products-status").textContent = filtered.length + " პროდუქტი";
  allLoadedProducts = filtered;
  totalPages        = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = 1;

  applySortAndRender();
  renderPagination();
}


function applySortAndRender() {
  const v = document.getElementById("f-sort").value;
  let s   = allLoadedProducts.slice();
  if (v === "price_asc")  s.sort(function (a, b) { return getPrice(a.price) - getPrice(b.price); });
  if (v === "price_desc") s.sort(function (a, b) { return getPrice(b.price) - getPrice(a.price); });
  if (v === "title_asc")  s.sort(function (a, b) { return (a.title||a.name||"").localeCompare(b.title||b.name||""); });
  if (v === "title_desc") s.sort(function (a, b) { return (b.title||b.name||"").localeCompare(a.title||a.name||""); });

  // client-side pagination
  const start = (currentPage - 1) * PAGE_SIZE;
  renderProducts(s.slice(start, start + PAGE_SIZE));
}

function showError(msg) {
  document.getElementById("products-status").textContent = "";
  document.getElementById("products-grid").innerHTML =
    `<div style="grid-column:1/-1;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.3);border-radius:12px;padding:20px;color:#f87171;font-size:13px;">❌ ${msg}</div>`;
}

function showSkeletons() {
  let html = "";
  for (let i = 0; i < PAGE_SIZE; i++)
    html += `<div class="skeleton-card"><div class="skeleton skeleton-img"></div><div class="skeleton-body"><div class="skeleton skeleton-line" style="width:40%"></div><div class="skeleton skeleton-line" style="width:80%"></div><div class="skeleton skeleton-line" style="width:50%"></div></div></div>`;
  document.getElementById("products-status").textContent = "იტვირთება...";
  document.getElementById("products-grid").innerHTML     = html;
  document.getElementById("pagination").innerHTML        = "";
}

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
  let url = "";
  if (p.thumbnail && typeof p.thumbnail === "string") url = p.thumbnail;
  else if (p.image && typeof p.image === "string")    url = p.image;
  else if (Array.isArray(p.images) && p.images.length > 0) {
    url = typeof p.images[0] === "string" ? p.images[0] : (p.images[0] && p.images[0].url ? p.images[0].url : "");
  }
  return url;
}

function setImgSrc(imgEl, url) {
  if (!url) { imgEl.src = "https://placehold.co/400x300/1e1e2a/6b6b80?text=No+Image"; return; }
  imgEl.removeAttribute("crossorigin");
  imgEl.onerror = function () {
    imgEl.onerror = null;
    imgEl.src = "https://placehold.co/400x300/1e1e2a/6b6b80?text=No+Image";
  };
  imgEl.src = url;
}
function getCategoryName(p) {
  if (!p.category) return "";
  return typeof p.category === "object" ? (p.category.name || "") : p.category;
}

function renderProducts(products) {
  const grid = document.getElementById("products-grid");
  if (!products || products.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)">😕 პროდუქტები ვერ მოიძებნა</div>`;
    return;
  }
  grid.innerHTML = "";
  products.forEach(function (p) {
    const amount  = typeof p.stock !== "undefined" ? p.stock : (typeof p.amount !== "undefined" ? p.amount : 0);
    const inStock = amount > 0;
    const card    = document.createElement("div");
    card.className    = "product-card" + (inStock ? "" : " out-of-stock");
    card.style.cursor = "pointer";
    const image   = getImageUrl(p);
    const title   = (p.title || p.name || "პროდუქტი").replace(/"/g, "&quot;");
    const catName = getCategoryName(p);
    card.innerHTML =
      '<img class="product-img" alt="' + title + '">' +
      '<div class="product-body">' +
        (catName ? '<div class="product-category">' + catName + '</div>' : '') +
        '<div class="product-title">' + title + '</div>' +
        '<div class="product-price">$' + Number(getPrice(p.price)).toFixed(2) + '</div>' +
      '</div>' +
      '<div class="product-footer">' +
        '<div class="amount-badge ' + (inStock ? "in-stock" : "out-of-stock") + '">' + (inStock ? "✔ " + amount + " მარაგში" : "✖ ამოწურულია") + '</div>' +
        (inStock ? '<button class="btn-add-cart">+ კალათაში</button>' : '') +
      '</div>';
    setImgSrc(card.querySelector(".product-img"), image);
    card.addEventListener("click", function () {
      localStorage.setItem("selected_product", JSON.stringify(p));
      window.location.href = "product.html?id=" + extractId(p._id || p.id);
    });
    if (inStock) {
      card.querySelector(".btn-add-cart").addEventListener("click", function (e) {
        e.stopPropagation(); addToCart(extractId(p._id || p.id));
      });
    }
    grid.appendChild(card);
  });
}

function renderPagination() {
  const el = document.getElementById("pagination");
  if (totalPages <= 1) { el.innerHTML = ""; return; }
  el.innerHTML = "";
  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn"; prevBtn.textContent = "← წინა"; prevBtn.disabled = currentPage <= 1;
  prevBtn.addEventListener("click", function () { goToPage(currentPage - 1); });
  el.appendChild(prevBtn);
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const btn = document.createElement("button");
      btn.className = "page-btn" + (i === currentPage ? " active" : ""); btn.textContent = i;
      btn.addEventListener("click", (function (p) { return function () { goToPage(p); }; })(i));
      el.appendChild(btn);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const dots = document.createElement("span"); dots.className = "page-info"; dots.textContent = "…"; el.appendChild(dots);
    }
  }
  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn"; nextBtn.textContent = "შემდეგი →"; nextBtn.disabled = currentPage >= totalPages;
  nextBtn.addEventListener("click", function () { goToPage(currentPage + 1); });
  el.appendChild(nextBtn);
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page; window.scrollTo({ top: 0, behavior: "smooth" }); applySortAndRender(); renderPagination();
}
function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () { currentPage = 1; applyFiltersAndRender(); renderPagination(); }, 300);
}
function resetFilters() {
  ["f-search","f-category","f-price-min","f-price-max","f-sort"].forEach(function (id) { document.getElementById(id).value = ""; });
  currentPage = 1; applyFiltersAndRender(); renderPagination();
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

async function addToCart(productId) {
  try {
    let response = await authFetch(SHOP_URL + "/cart/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, quantity: 1 }),
    });

    if (!response.ok) {
      const errData = await response.clone().json().catch(function () { return {}; });
      const msg = errData.error || errData.message || "";
      // cart უკვე არსებობს — PATCH-ით დავამატოთ
      if (response.status === 400) {
        response = await authFetch(SHOP_URL + "/cart/product", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: productId, quantity: 1 }),
        });
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(function () { return {}; });
      showToast("❌ " + (errData.error || errData.message || "შეცდომა"), "error");
      return;
    }

    const data = await response.json();
    renderCart(data);
    const badge = document.getElementById("cart-count");
    badge.style.transform = "scale(1.5)";
    setTimeout(function () { badge.style.transform = "scale(1)"; }, 200);
    showToast("✅ პროდუქტი კალათაში დაემატა!", "success");
  } catch (err) {
    console.error("addToCart:", err);
    showToast("❌ კავშირის შეცდომა: " + err.message, "error");
  }
}


async function updateCartQuantity(productId, newQty) {
  try {
    if (newQty < 1) {
      await removeFromCart(productId); return;
    }
    let response = await authFetch(SHOP_URL + "/cart/product", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, quantity: newQty }),
    });
    if (response.ok) { renderCart(await response.json()); return; }
    // თუ error — DELETE + re-add
    await removeFromCart(productId);
    if (newQty > 0) await addToCart(productId);
  } catch (err) { console.error("updateCartQuantity:", err); }
}

async function removeFromCart(productId) {
  try {
    const response = await authFetch(SHOP_URL + "/cart/product", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId }),
    });
    if (response.ok) { renderCart(await response.json()); return; }
    // fallback
    const r2 = await authFetch(SHOP_URL + "/cart/product", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: productId }),
    });
    if (r2.ok) { renderCart(await r2.json()); }
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
        '<button class="qty-btn qty-minus" title="შემცირება">−</button>' +
        '<span class="qty-val">' + qty + '</span>' +
        '<button class="qty-btn qty-plus" title="გაზრდა">+</button>' +
      '</div>' +
      '<button class="cart-item-remove" title="წაშლა">🗑</button>';

    setImgSrc(el.querySelector(".cart-item-img"), img);
    el.querySelector(".qty-minus").addEventListener("click", function () {
      updateCartQuantity(id, qty - 1);
    });
    el.querySelector(".qty-plus").addEventListener("click", function () {
      updateCartQuantity(id, qty + 1);
    });
    el.querySelector(".cart-item-remove").addEventListener("click", function () {
      removeFromCart(id);
    });

    itemsEl.appendChild(el);
  });

  document.getElementById("cart-total").textContent = "$" + Number(totalPrice).toFixed(2);
  footer.style.display = "block";
}


function showToast(message, type) {
  let t = document.getElementById("shop-toast");
  if (!t) {
    t = document.createElement("div"); t.id = "shop-toast";
    t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;font-size:13px;z-index:9999;opacity:0;transition:all 0.3s ease;pointer-events:none;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,0.4);";
    document.body.appendChild(t);
  }
  t.textContent   = message;
  t.style.color   = type === "success" ? "var(--success)" : "var(--error)";
  t.style.borderColor = type === "success" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)";
  t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(20px)"; }, 3000);
}
