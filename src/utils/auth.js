import { loginUser } from "../utils/api.js";
import { decodeToken } from "../utils/utility.js";

// init login form
export function initLogin() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin();
  });

  const toggleBtn = document.getElementById("toggle-login-password");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () =>
      togglePassword("login-password", toggleBtn),
    );
  }
}

// handle login form submission
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorMsg = document.getElementById("login-error");
  const btn = document.getElementById("login-submit-btn");

  // validation
  if (!email || !password) {
    errorMsg.textContent = "Please fill in all fields.";
    return;
  }

  errorMsg.textContent = "";
  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    const data = await loginUser(email, password);

    if (!data || !data.user || !data.accessToken) {
      errorMsg.textContent = "Invalid email or password.";
      btn.disabled = false;
      btn.textContent = "Sign In";
      return;
    }

    const { user, accessToken, refreshToken } = data;

    localStorage.setItem("token", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    //decode token to see if normal user or admin
    const decoded = decodeToken(accessToken);

    if (decoded?.isAdmin) {
      window.location.href = "admin.html";
    } else {
      window.location.href = "index.html";
    }
  } catch (error) {
    errorMsg.textContent = "Login failed. Please try again.";
    btn.disabled = false;
    btn.textContent = "Login";
  }
}

// Logout function — clear localStorage and redirect to home page
export function logoutUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

// session management functions for checking login status and user role
export function getCurrentUser() {
  const token = localStorage.getItem("token");
  return decodeToken(token);
}

export function isLoggedIn() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Date.now() / 1000;

    return payload.exp > now;
  } catch {
    return false;
  }
}

export function isAdmin() {
  const user = getCurrentUser();
  return user ? user.isAdmin : false;
}

// toggle password visibility function for both login and register forms
export function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "Hide";
  } else {
    input.type = "password";
    btn.textContent = "Show";
  }
}

// after successful login or logout, call updateNavbar to refresh the links and buttons in the navbar based on the user's login status and role
export function updateNavbar() {
  const user = getCurrentUser();
  const loginLink = document.getElementById("nav-login");
  const adminLink = document.getElementById("nav-admin");
  const logoutBtn = document.getElementById("nav-logout");
  const cartLink = document.getElementById("nav-cart"); // hide cart link for admin users

  const loginLi = loginLink ? loginLink.parentElement : null;
  const adminLi = adminLink ? adminLink.parentElement : null;
  const logoutLi = logoutBtn ? logoutBtn.parentElement : null;
  const cartLi = cartLink ? cartLink.parentElement : null;

  if (user && user.isAdmin) {
    // admin
    if (loginLi) loginLi.style.display = "none"; // hide login link for admin
    if (cartLi) cartLi.style.display = "none"; // hide cart link for admin
    if (adminLi) adminLi.style.display = "list-item";
    if (logoutLi) logoutLi.style.display = "list-item";
  } else if (user) {
    // regular user
    if (loginLink) {
      loginLink.textContent = "Profile";
      loginLink.href = "profile.html";
      
      // Set active class based on current page
      const currentPage = window.location.pathname;
      const navLinks = document.querySelectorAll(".nav-links a");
      navLinks.forEach(link => {
        link.classList.remove("active");
        if (link.href.includes(currentPage.split("/").pop())) {
          link.classList.add("active");
        }
});
    }
    if (adminLi) adminLi.style.display = "none";
    if (logoutLi) logoutLi.style.display = "list-item";
  } else {
    // not logged in
    if (loginLink) {
      loginLink.textContent = "Login";
      loginLink.href = "auth.html";
    }
    if (adminLi) adminLi.style.display = "none";
    if (logoutLi) logoutLi.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavbar();

  const logoutBtn = document.getElementById("nav-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }
});
