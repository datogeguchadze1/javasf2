const BASE_URL = "https://api.everrest.educata.dev";

window.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("access_token");

  if (!token) {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("btn-signout").addEventListener("click", doSignOut);
  document.getElementById("btn-shop").addEventListener("click", function () {
    window.location.href = "shop.html";
  });

  // Mobile burger menu
  const burgerBtn = document.getElementById("burger-btn");
  const mobileNav = document.getElementById("mobile-nav");
  burgerBtn.addEventListener("click", function () {
    const open = mobileNav.classList.toggle("open");
    burgerBtn.classList.toggle("open", open);
  });
  document.getElementById("m-btn-shop").addEventListener("click", function () {
    window.location.href = "shop.html";
  });
  document.getElementById("m-btn-signout").addEventListener("click", doSignOut);
  document.getElementById("btn-logo").addEventListener("click", function () {
    window.location.href = "shop.html";
  });
  document.getElementById("btn-update").addEventListener("click", doUpdateProfile);
  document.getElementById("btn-change-password").addEventListener("click", doChangePassword);

  document.getElementById("toggle-old").addEventListener("click", function () {
    togglePass("cp-old", this);
  });
  document.getElementById("toggle-new").addEventListener("click", function () {
    togglePass("cp-new", this);
  });
  document.getElementById("toggle-confirm").addEventListener("click", function () {
    togglePass("cp-confirm", this);
  });

  loadUserData(token);
});

function doSignOut() {
  try {
    const token = localStorage.getItem("access_token");
    fetch(BASE_URL + "/auth/sign_out", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    }).catch(function () {});
  } catch (e) {}

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "signin.html";
}

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

function showAlert(elementId, type, message) {
  try {
    const icon = type === "success" ? "✅" : "❌";
    document.getElementById(elementId).innerHTML =
      `<div class="alert ${type}"><span>${icon}</span><span>${message}</span></div>`;
  } catch (e) {}
}

async function loadUserData(token) {
  try {
    const response = await fetch(BASE_URL + "/auth", {
      headers: { Authorization: "Bearer " + token },
    });

    if (!response.ok) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "signin.html";
      return;
    }

    const user = await response.json();
    window.currentUser = user;
    fillForm(user);
  } catch (err) {
    console.error("მომხმარებლის მონაცემები ვერ ჩაიტვირთა:", err);
    localStorage.removeItem("access_token");
    window.location.href = "signin.html";
  }
}

function fillForm(user) {
  try {
    document.getElementById("p-avatar").src =
      user.avatar || "https://api.dicebear.com/7.x/pixel-art/svg?seed=" + user.email;

    document.getElementById("p-name").textContent  = user.firstName + " " + user.lastName;
    document.getElementById("p-email").textContent = user.email;

    const badge = document.getElementById("p-verified");
    if (user.verified) {
      badge.textContent = "✔ ვერიფიცირებული";
      badge.className   = "profile-badge verified";
    } else {
      badge.textContent = "✖ არ არის ვერიფიცირებული";
      badge.className   = "profile-badge unverified";
    }

    document.getElementById("p-firstName").value   = user.firstName || "";
    document.getElementById("p-lastName").value    = user.lastName  || "";
    document.getElementById("p-age").value         = user.age       || "";
    document.getElementById("p-gender").value      = user.gender    || "MALE";
    document.getElementById("p-email-input").value = user.email     || "";
    document.getElementById("p-address").value     = user.address   || "";
    document.getElementById("p-phone").value       = user.phone     || "";
    document.getElementById("p-zipcode").value     = user.zipcode   || "";
    document.getElementById("p-avatar-url").value  = user.avatar    || "";
  } catch (e) {
    console.error("ფორმის შევსება ვერ მოხერხდა:", e);
  }
}

async function doUpdateProfile() {
  try {
    const firstName = document.getElementById("p-firstName").value.trim();
    const lastName  = document.getElementById("p-lastName").value.trim();
    const age       = parseInt(document.getElementById("p-age").value);
    const gender    = document.getElementById("p-gender").value;
    const email     = document.getElementById("p-email-input").value.trim();
    const address   = document.getElementById("p-address").value.trim();
    const phone     = document.getElementById("p-phone").value.trim();
    const zipcode   = document.getElementById("p-zipcode").value.trim();
    const avatar    = document.getElementById("p-avatar-url").value.trim();

    if (!firstName || !lastName || !email || !address || !phone || !zipcode) {
      showAlert("update-alert", "error", "გთხოვთ შეავსოთ ყველა ველი");
      return;
    }

    if (!age || age < 1) {
      showAlert("update-alert", "error", "ასაკი სწორად შეიყვანეთ");
      return;
    }

    const token    = localStorage.getItem("access_token");
    const response = await fetch(BASE_URL + "/auth/update", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ firstName, lastName, age, gender, email, address, phone, zipcode, avatar }),
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert("update-alert", "error", data.message || "განახლება ვერ მოხერხდა");
      return;
    }

    window.currentUser = Object.assign(window.currentUser, data);
    fillForm(window.currentUser);
    showAlert("update-alert", "success", "პროფილი წარმატებით განახლდა!");
  } catch (err) {
    console.error("პროფილის განახლება ვერ მოხერხდა:", err);
    showAlert("update-alert", "error", "შეცდომა: " + err.message);
  }
}

async function doChangePassword() {
  try {
    const oldPassword = document.getElementById("cp-old").value;
    const newPassword = document.getElementById("cp-new").value;
    const confirm     = document.getElementById("cp-confirm").value;

    if (!oldPassword || !newPassword || !confirm) {
      showAlert("password-alert", "error", "გთხოვთ შეავსოთ ყველა ველი");
      return;
    }

    if (newPassword.length < 8) {
      showAlert("password-alert", "error", "ახალი პაროლი მინიმუმ 8 სიმბოლო");
      return;
    }

    if (newPassword !== confirm) {
      showAlert("password-alert", "error", "ახალი პაროლები არ ემთხვევა");
      return;
    }

    if (oldPassword === newPassword) {
      showAlert("password-alert", "error", "ახალი პაროლი განსხვავებული უნდა იყოს");
      return;
    }

    const token    = localStorage.getItem("access_token");
    const response = await fetch(BASE_URL + "/auth/change_password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert("password-alert", "error", data.message || "პაროლის შეცვლა ვერ მოხერხდა");
      return;
    }

    if (data.access_token) {
      localStorage.setItem("access_token",  data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token || localStorage.getItem("refresh_token"));
    }

    showAlert("password-alert", "success", "🔒 პაროლი წარმატებით შეიცვალა!");

    document.getElementById("cp-old").value     = "";
    document.getElementById("cp-new").value     = "";
    document.getElementById("cp-confirm").value = "";
  } catch (err) {
    console.error("პაროლის შეცვლა ვერ მოხერხდა:", err);
    showAlert("password-alert", "error", "შეცდომა: " + err.message);
  }
}
