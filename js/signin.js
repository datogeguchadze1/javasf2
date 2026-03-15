const BASE_URL = "https://api.everrest.educata.dev";

window.addEventListener("DOMContentLoaded", function () {
  try {
    const prefill = localStorage.getItem("prefill_email");
    if (prefill) {
      document.getElementById("email").value = prefill;
      localStorage.removeItem("prefill_email");
    }

    if (localStorage.getItem("access_token")) {
      window.location.href = "shop.html";
      return;
    }

    document.getElementById("signin-btn").addEventListener("click", doSignIn);

    document.getElementById("password").addEventListener("keydown", function (e) {
      if (e.key === "Enter") doSignIn();
    });

    document.getElementById("toggle-password").addEventListener("click", function () {
      togglePass("password", this);
    });
  } catch (e) {
    console.error("ინიციალიზაციის შეცდომა:", e);
  }
});

function togglePass(inputId, btn) {
  try {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
      input.type      = "text";
      btn.textContent = "🙈";
    } else {
      input.type      = "password";
      btn.textContent = "👁";
    }
  } catch (e) {}
}

function showAlert(type, message) {
  try {
    const icon = type === "success" ? "✅" : "❌";
    document.getElementById("alert").innerHTML =
      `<div class="alert ${type}"><span>${icon}</span><span>${message}</span></div>`;
  } catch (e) {}
}

async function doSignIn() {
  try {
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      showAlert("error", "გთხოვთ შეავსოთ ყველა ველი");
      return;
    }

    const btn = document.getElementById("signin-btn");
    btn.disabled    = true;
    btn.textContent = "გთხოვთ მოიცადოთ...";

    const response = await fetch(BASE_URL + "/auth/sign_in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(function () { return {}; });

    btn.disabled    = false;
    btn.textContent = "შესვლა";

    if (!response.ok) {
      showAlert("error", data.message || "შეცდომა, სცადეთ ხელახლა");
      return;
    }

    localStorage.setItem("access_token",  data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    window.location.href = "shop.html";
  } catch (err) {
    console.error("შესვლის შეცდომა:", err);
    showAlert("error", "კავშირის შეცდომა: " + err.message);

    const btn = document.getElementById("signin-btn");
    btn.disabled    = false;
    btn.textContent = "შესვლა";
  }
}
