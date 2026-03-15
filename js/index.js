const BASE_URL = "https://api.everrest.educata.dev";

window.addEventListener("DOMContentLoaded", function () {
  document.getElementById("signup-btn").addEventListener("click", doSignUp);

  document.getElementById("toggle-password").addEventListener("click", function () {
    togglePass("password", this);
  });
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
    const alertBox = document.getElementById("alert");
    const icon = type === "success" ? "✅" : "❌";
    alertBox.innerHTML =
      `<div class="alert ${type}"><span>${icon}</span><span>${message}</span></div>`;
  } catch (e) {}
}

async function doSignUp() {
  try {
    const firstName = document.getElementById("firstName").value.trim();
    const lastName  = document.getElementById("lastName").value.trim();
    const age       = parseInt(document.getElementById("age").value);
    const gender    = document.getElementById("gender").value;
    const email     = document.getElementById("email").value.trim();
    const password  = document.getElementById("password").value;
    const address   = document.getElementById("address").value.trim();
    const phone     = document.getElementById("phone").value.trim();
    const zipcode   = document.getElementById("zipcode").value.trim();

    let avatar = document.getElementById("avatar").value.trim();
    if (!avatar) {
      avatar = "https://api.dicebear.com/7.x/pixel-art/svg?seed=" + Date.now();
    }

    if (!firstName || !lastName || !email || !password || !address || !phone || !zipcode) {
      showAlert("error", "გთხოვთ შეავსოთ ყველა სავალდებულო ველი");
      return;
    }

    if (!gender) {
      showAlert("error", "გთხოვთ აირჩიოთ სქესი");
      return;
    }

    if (!age || age < 1) {
      showAlert("error", "ასაკი სწორად შეიყვანეთ");
      return;
    }

    if (password.length < 8) {
      showAlert("error", "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს");
      return;
    }

    const btn = document.getElementById("signup-btn");
    btn.disabled    = true;
    btn.textContent = "გთხოვთ მოიცადოთ...";

    const response = await fetch(BASE_URL + "/auth/sign_up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, age, gender, email, password, address, phone, zipcode, avatar }),
    });

    const data = await response.json().catch(function () { return {}; });

    btn.disabled    = false;
    btn.textContent = "რეგისტრაცია";

    if (!response.ok) {
      showAlert("error", data.message || "რეგისტრაცია ვერ მოხერხდა (სტატუსი: " + response.status + ")");
      return;
    }

    showAlert("success", "✉️ წარმატებულია! შეამოწმეთ ელ-ფოსტა ვერიფიკაციისთვის.");

    setTimeout(function () {
      localStorage.setItem("prefill_email", email);
      window.location.href = "html/signin.html";
    }, 3000);
  } catch (err) {
    console.error("რეგისტრაციის შეცდომა:", err);
    showAlert("error", "კავშირის შეცდომა: " + err.message);

    const btn = document.getElementById("signup-btn");
    btn.disabled    = false;
    btn.textContent = "რეგისტრაცია";
  }
}
