import {
  getCurrentUser,
  isLoggedIn,
  logoutUser,
  togglePassword,
} from "../utils/auth.js";
import {
  getMyOrders,
  updateUser,
  getProducts,
  getVariants,
  getMe,
  removeFromWishlist,
} from "../utils/api.js";
import {
  formatDateISO,
  checkIfUserHasAddress,
  countdownTimer,
  addToCart,
  updateCartBadge,
} from "../utils/utility.js";
import { goToProduct } from "./product-detail.js";

updateCartBadge();

document.addEventListener("DOMContentLoaded", () => {
  // guard — if user is not logged in, redirect to login page
  if (!isLoggedIn()) {
    window.location.href = "auth.html";
    return;
  }

  loadProfile();
  editProfile();

  // logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }
});

async function loadProfile() {
  const user = getCurrentUser();
  const fullUser = await getMe();
  if (!user) return;

  const myOrders = await getMyOrders(user.id);
  renderMyOrders(myOrders);

  checkIfUserHasAddress("add-address", "profile-address");

  // show user info on the profile page
  document.querySelector(".profile-name").textContent = fullUser.name;
  document.querySelector(".profile-email").textContent = fullUser.email;
  document.querySelector(".profile-password").textContent = `************`;

  const allProducts = await getProducts();
  const allVariants = await getVariants();
  const userWishlist = fullUser.wishlist || [];

  const wishlistItems = userWishlist.map((item) => {
    const product = allProducts.find((product) => product._id === item.product);
    const variant = allVariants.find((variant) => variant._id === item.variant);
    return { product, variant };
  });

  renderWishlist(wishlistItems);
}

function renderMyOrders(orders) {
  const orderHistory = document.getElementById("order-history-list");
  orderHistory.innerHTML = '';

  if (orders.length === 0) {
    orderHistory.textContent = "You have no orders yet";
    return;
  }
  orders.forEach((order) => {
    const orderCard = createOrderCard(order);
    orderHistory.appendChild(orderCard);
  });
}

function createOrderCard(order) {
  const orderCard = document.createElement("div");
  orderCard.className = "order-card";
  orderCard.style.cursor = "pointer";

  const header = document.createElement("div");
  header.className = "order-card__header";

  const date = document.createElement("span");
  date.className = "order-card__date";
  date.textContent = formatDateISO(order.createdAt);

  const status = document.createElement("span");
  status.className = "order-card__status";
  status.textContent = order.status;

  if (order.status === "pending") status.classList.add("order-card__status--pending");
  else if (order.status === "confirmed") status.classList.add("order-card__status--confirmed");
  else if (order.status === "shipped") status.classList.add("order-card__status--shipped");
  else if (order.status === "cancelled") status.classList.add("order-card__status--cancelled");

  const total = document.createElement("span");
  total.className = "order-card__total";
  total.textContent = `$${order.totalCost.toFixed(2)}  ·  ${order.numOfItems} items`;

  header.appendChild(date);
  header.appendChild(status);
  header.appendChild(total);

  const productList = document.createElement("ul");
  productList.className = "order-card__products";

  order.products.forEach((product) => {
    const item = document.createElement("li");
    item.className = "order-card__product";

    const nameSpan = document.createElement("span");
    nameSpan.className = "order-card__product-name";
    nameSpan.textContent = product.name;

    const sizeSpan = document.createElement("span");
    sizeSpan.className = "order-card__product-size";
    sizeSpan.textContent = `Size ${product.size}`;

    const priceSpan = document.createElement("span");
    priceSpan.className = "order-card__product-price";
    priceSpan.textContent = `$${product.price.toFixed(2)}`;

    item.appendChild(nameSpan);
    item.appendChild(sizeSpan);
    item.appendChild(priceSpan);
    productList.appendChild(item);
  });

  orderCard.appendChild(header);
  orderCard.appendChild(productList);

  // Click to open modal
  orderCard.addEventListener("click", () => openOrderModal(order));

  return orderCard;
}

function openOrderModal(order) {
  const background = document.createElement("div");
  background.classList.add("profile-modal-bg");

  const modal = document.createElement("div");
  modal.classList.add("profile-modal");

  // Header
  const header = document.createElement("div");
  header.classList.add("profile-modal__header");

  const title = document.createElement("p");
  title.classList.add("profile-modal__label");
  title.innerText = "Order Confirmed";

  const orderId = document.createElement("p");
  orderId.classList.add("profile-modal__id");
  orderId.innerText = `#${order._id}`;

  const date = document.createElement("p");
  date.classList.add("profile-modal__date");
  date.innerText = formatDateISO(order.createdAt);

  const closeBtn = document.createElement("button");
  closeBtn.classList.add("profile-modal__close");
  closeBtn.innerText = "✕";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", () => background.remove());

  header.append(title, orderId, date, closeBtn);

  // Address
  const addressSection = document.createElement("div");
  addressSection.classList.add("profile-modal__section");

  const addressLabel = document.createElement("p");
  addressLabel.classList.add("profile-modal__section-label");
  addressLabel.innerText = "Shipping to";

  const addr = order.user?.address;
  const addressValue = document.createElement("p");
  addressValue.classList.add("profile-modal__section-value");
  addressValue.innerText = addr
    ? `${addr.street}, ${addr.city}, ${addr.postalCode}, ${addr.country}`
    : "No address on file";

  addressSection.append(addressLabel, addressValue);

  // Products
  const productsSection = document.createElement("div");
  productsSection.classList.add("profile-modal__section");

  const productsLabel = document.createElement("p");
  productsLabel.classList.add("profile-modal__section-label");
  productsLabel.innerText = "Items";

  productsSection.append(productsLabel);

  order.products.forEach((product) => {
    const row = document.createElement("div");
    row.classList.add("profile-modal__product");

    const name = document.createElement("span");
    name.classList.add("profile-modal__product-name");
    name.innerText = product.name;

    const size = document.createElement("span");
    size.classList.add("profile-modal__product-size");
    size.innerText = `Size ${product.size}`;

    const price = document.createElement("span");
    price.classList.add("profile-modal__product-price");
    price.innerText = `$${product.price.toFixed(2)}`;

    row.append(name, size, price);
    productsSection.append(row);
  });

  // Total
  const totalSection = document.createElement("div");
  totalSection.classList.add("profile-modal__total");

  const totalLabel = document.createElement("span");
  totalLabel.innerText = "Total";

  const totalAmount = document.createElement("span");
  totalAmount.classList.add("profile-modal__total-amount");
  totalAmount.innerText = `$${order.totalCost.toFixed(2)}`;

  totalSection.append(totalLabel, totalAmount);

  modal.append(header, addressSection, productsSection, totalSection);
  background.append(modal);
  document.body.append(background);

  background.addEventListener("click", (e) => {
    if (e.target === background) background.remove();
  });
}

async function editProfile() {
  const editSection = document.getElementById("profile-edit-section");
  const infoSection = document.getElementById("profile-info-section");

  const btnEdit = document.getElementById("edit-profile-btn");
  const btnCancel = document.getElementById("cancel-edit-btn");
  const btnSave = document.getElementById("save-profile-btn");

  const fullUser = await getMe();

  btnEdit.addEventListener("click", () => {
    if (editSection.classList.contains("hidden")) {
      editSection.classList.remove("hidden");
      infoSection.classList.add("hidden");
      btnEdit.textContent = "Cancel edit";

      document.getElementById("edit-name").value = fullUser.name;
      document.getElementById("edit-email").value = fullUser.email;

      if (fullUser.address) {
        document.getElementById("edit-street").value = fullUser.address.street;
        document.getElementById("edit-postal-code").value =
          fullUser.address.postalCode;
        document.getElementById("edit-city").value = fullUser.address.city;
        document.getElementById("edit-country").value =
          fullUser.address.country;
      }
    } else {
      editSection.classList.add("hidden");
      infoSection.classList.remove("hidden");
      btnEdit.textContent = "Edit Profile";
    }
  });

  btnCancel.addEventListener("click", () => {
    editSection.classList.add("hidden");
    infoSection.classList.remove("hidden");
    btnEdit.textContent = "Edit Profile";
  });

  btnSave.addEventListener("click", async (event) => {
    event.preventDefault();

    const nameError = document.querySelector(".name-error");
    const emailError = document.querySelector(".email-error");
    const passwordError = document.querySelector(".password-error");

    nameError.textContent = "";
    emailError.textContent = "";
    passwordError.textContent = "";

    const name = document.getElementById("edit-name").value;
    const email = document.getElementById("edit-email").value;
    const street = document.getElementById("edit-street").value;
    const postalCode = document.getElementById("edit-postal-code").value;
    const city = document.getElementById("edit-city").value;
    const country = document.getElementById("edit-country").value;
    const editPassword = document.getElementById("edit-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!name) {
      nameError.textContent = `Please enter a name`;
      return;
    }

    if (!email) {
      emailError.textContent = `Please enter an email address`;
      return;
    }

    if (editPassword) {
      if (editPassword.length < 8) {
        passwordError.textContent = "Password must be at least 8 characters.";
        return;
      }
      if (!/[A-Z]/.test(editPassword)) {
        passwordError.textContent =
          "Password must contain at least one capital letter.";
        return;
      }
      if (!/[0-9]/.test(editPassword)) {
        passwordError.textContent =
          "Password must contain at least one number.";
        return;
      }
      if (!/[!@#$%&*]/.test(editPassword)) {
        passwordError.textContent =
          "Password must contain at least one special character (! @ # $ % & *).";
        return;
      }
      if (editPassword !== confirmPassword) {
        passwordError.textContent = "Passwords do not match!";
        return;
      }
    }

    const data = {
      name: name,
      email: email,
      address: {
        street: street,
        postalCode: postalCode,
        city: city,
        country: country,
      },
    };

    if (editPassword) {
      data.password = editPassword;
    }

    const result = await updateUser(data);
    const saveSuccess = document.querySelector(".save-success");
    const saveError = document.querySelector(".save-error");

    if (result) {
      localStorage.setItem("user", JSON.stringify(result));
      // NOTE: saveSuccess message and switch from edit to profile view may not be visible because
      // Live Server reloads the page when db.json changes.
      // This won't be an issue with the real API.
      saveSuccess.textContent = `Save successful`;
      await loadProfile();
      editSection.classList.add("hidden");
      infoSection.classList.remove("hidden");
      btnEdit.textContent = "Edit Profile";
      setTimeout(() => {
        saveSuccess.textContent = "";
      }, 5000);
    } else {
      saveError.textContent = `Save failed. Try again later`;
    }
  });

  const addAddressBtn = document.querySelector(".add-address button");
  if (addAddressBtn) {
    addAddressBtn.addEventListener("click", () => {
      btnEdit.click();
    });
  }

  document
    .getElementById("edit-password")
    .addEventListener("input", checkEditPasswordRules);
  const toggleEditPw = document.getElementById("toggle-edit-password");
  toggleEditPw.addEventListener("click", () =>
    togglePassword("edit-password", toggleEditPw),
  );
}

function checkEditPasswordRules() {
  const password = document.getElementById("edit-password").value;

  const rules = {
    "edit-req-length": password.length >= 8,
    "edit-req-upper": /[A-Z]/.test(password),
    "edit-req-number": /[0-9]/.test(password),
    "edit-req-special": /[!@#$%&*]/.test(password),
  };

  for (const [id, passed] of Object.entries(rules)) {
    const el = document.getElementById(id);
    el.style.color = passed ? "green" : "";
  }
}

function renderWishlist(wishlistItems) {
  const wishlistContainer = document.getElementById("wishlist-list");
  wishlistContainer.innerHTML = '';

  if (wishlistItems.length === 0) {
    wishlistContainer.textContent = `Your wishlist is empty`;
    return;
  }

  wishlistItems.forEach(({ product, variant }) => {
    if (!product || !variant) return;

    const wishlistCard = createWishlistCard(product, variant);
    wishlistContainer.appendChild(wishlistCard);
  });
}

function createWishlistCard(product, variant) {
  const wishlistCard = document.createElement("div");
  wishlistCard.className = "wishlist-card";

  if (product.status !== "upcoming" && product.status !== "live") {
    wishlistCard.classList.add("wishlist-card--sold-out");
  }

  let imageElement;
  if (product.image) {
    imageElement = document.createElement("img");
    imageElement.className = "wishlist-card__image";
    imageElement.src = product.image;
    imageElement.alt = product.name;
    imageElement.loading = "lazy";
  } else {
    imageElement = document.createElement("div");
    imageElement.className = "wishlist-card__image";
    imageElement.textContent = "👟";
  }

  const info = document.createElement("div");
  info.className = "wishlist-card__info";

  const name = document.createElement("h3");
  name.className = "wishlist-card__name";
  name.textContent = product.name;

  const meta = document.createElement("div");
  meta.className = "wishlist-card__meta";

  const priceSpan = document.createElement("span");
  const priceLabel = document.createElement("label");
  priceLabel.textContent = "Price";
  const priceValue = document.createElement("span");
  priceValue.className = "value";
  priceValue.textContent = `$${product.price.toFixed(2)}`;
  priceSpan.appendChild(priceLabel);
  priceSpan.appendChild(priceValue);

  const sizeSpan = document.createElement("span");
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = "Size";
  const sizeValue = document.createElement("span");
  sizeValue.className = "value";
  sizeValue.textContent = `US ${variant.size}`;
  sizeSpan.appendChild(sizeLabel);
  sizeSpan.appendChild(sizeValue);

  meta.appendChild(priceSpan);
  meta.appendChild(sizeSpan);

  info.appendChild(name);
  info.appendChild(meta);

  const statusColumn = document.createElement("div");
  statusColumn.className = "wishlist-card__status-column";

  let statusElement;
  if (product.status === "upcoming") {
    statusElement = document.createElement("p");
    statusElement.className = "wishlist-card__countdown";
    countdownTimer(product.dropDate, statusElement);
  } else if (product.status === "live") {
    statusElement = document.createElement("button");
    statusElement.className = "btn btn--primary";
    statusElement.textContent = "Buy Now";

    statusElement.addEventListener("click", (event) => {
      event.stopPropagation();
      const result = addToCart(product._id, variant._id, variant.size);

      if (result.success) {
        statusElement.textContent = "Added to Cart";
        statusElement.disabled = true;
        statusElement.classList.add("btn--added");
        setTimeout(() => {
          statusElement.textContent = "Buy Now";
          statusElement.disabled = false;
          statusElement.classList.remove("btn--added");
        }, 3000);
      } else if (result.error === "duplicate_size") {
        statusElement.textContent = "Already in Cart";
        statusElement.disabled = true;
        statusElement.classList.add("btn--added");
        setTimeout(() => {
          statusElement.textContent = "Buy Now";
          statusElement.disabled = false;
          statusElement.classList.remove("btn--added");
        }, 3000);
      }
    });
  } else {
    statusElement = document.createElement("span");
    statusElement.className =
      "wishlist-card__badge wishlist-card__badge--sold-out";
    statusElement.textContent = "Sold Out";
  }
  statusColumn.appendChild(statusElement);

  const removeBtn = document.createElement("button");
  removeBtn.className = "wishlist-card__remove";
  removeBtn.textContent = "×";
  removeBtn.title = "Remove from wishlist";

  //remove from wishlist
  removeBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const token = localStorage.getItem("token");
    const result = await removeFromWishlist(token, product._id, variant._id);

    if (result) {
      wishlistCard.remove();
    }
  });

  wishlistCard.appendChild(imageElement);
  wishlistCard.appendChild(info);
  wishlistCard.appendChild(statusColumn);
  wishlistCard.appendChild(removeBtn);

  wishlistCard.addEventListener("click", () => goToProduct(product._id));

  return wishlistCard;
}
