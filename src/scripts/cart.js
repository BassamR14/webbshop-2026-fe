import {
  getProducts,
  getVariants,
  postOrder,
  getMe,
  updateUser,
} from "../utils/api.js";
import { getCurrentUser } from "../utils/auth.js";
import { checkIfUserHasAddress, updateCartBadge } from "../utils/utility.js";

updateCartBadge();
let isEditingAddress = false;

//Function render cart products in the cart page
async function renderCart(products, variants) {
  let subtotal = 0;
  const cartContainer = document.querySelector(".cart-container");

  cartContainer.innerHTML = "";
  cartContainer.classList.remove("empty-cart");

  try {
    const user = getCurrentUser();
    const cart = (JSON.parse(localStorage.getItem("cart")) || []).filter(
      (item) => item.userId === user.userId,
    );

    if (cart.length > 0) {
      cart.forEach((item) => {
        //Match the products in the cart with the database
        const product = products.find((p) => p._id === item.productId);

        const variant = variants.find(
          (v) => v.productId === item.productId && v.size === item.size,
        );

        if (!product || !variant) return;

        const cartItem = document.createElement("div");
        cartItem.classList.add("cart-item");

        const imgDiv = document.createElement("div");
        imgDiv.classList.add("cart-item-img");
        const img = document.createElement("img");
        img.src = product.image;
        imgDiv.append(img);

        const infoDiv = document.createElement("div");
        infoDiv.classList.add("cart-item-info");

        const name = document.createElement("span");
        name.classList.add("product-name");
        name.textContent = product.name;

        const size = document.createElement("span");
        size.classList.add("product-size");
        size.textContent = `Size: ${variant.size} US`;

        const removeItemBtn = document.createElement("button");
        removeItemBtn.classList.add("remove-btn");
        removeItemBtn.innerText = "Remove";

        infoDiv.append(name, size, removeItemBtn);

        const price = document.createElement("span");
        price.classList.add("product-price");
        price.textContent = `$${product.price}`;

        cartItem.append(imgDiv, infoDiv, price);
        cartContainer.append(cartItem);

        subtotal += product.price;

        removeItemBtn.addEventListener("click", () => {
          let cart = JSON.parse(localStorage.getItem("cart")) || [];

          // Remove the clicked item (match both productId + size)
          cart = cart.filter(
            (cartItem) =>
              !(
                cartItem.userId === user.userId &&
                cartItem.productId === item.productId &&
                cartItem.size === item.size
              ),
          );

          localStorage.setItem("cart", JSON.stringify(cart));

          // Re-render cart
          renderCart();
          updateCartBadge();
        });
      });
    } else {
      cartContainer.innerHTML = "";
      cartContainer.textContent = "Cart is empty";
      cartContainer.classList.add("empty-cart");
    }

    // Extract 25% VAT from total (included in price)
    const vatRate = 0.25;
    const taxes = subtotal - subtotal / (1 + vatRate);
    const subtotalExVat = subtotal / (1 + vatRate);

    const subtotalEl = document.querySelector(".subtotal");
    const taxesEl = document.querySelector(".taxes");

    subtotalEl.textContent = `$ ${subtotalExVat.toFixed(2)}`;
    taxesEl.textContent = `$ ${taxes.toFixed(2)}`;

    const totalPrice = document.querySelector(".total-price");
    totalPrice.textContent = `$${subtotal.toFixed(2)}`;
  } catch (err) {
    console.error(err);
  }
}

async function setupAddressEdit(fullUser) {
  if (!fullUser) return;
  if (!fullUser.address) return;

  const userAddress = document.querySelector(".user-address");
  const addressForm = document.querySelector(".address-form");

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit address";
  editBtn.className = "btn btn--outline";
  editBtn.style.marginTop = "12px";
  userAddress.append(editBtn);

  editBtn.addEventListener("click", (event) => {
    event.preventDefault();
    isEditingAddress = true;
    document.querySelector(".fullname-input").value = fullUser.name;
    document.querySelector(".street-input").value = fullUser.address.street;
    document.querySelector(".city-input").value = fullUser.address.city;
    document.querySelector(".postal-code-input").value =
      fullUser.address.postalCode;
    document.querySelector(".country-input").value = fullUser.address.country;

    userAddress.style.display = "none";
    addressForm.style.display = "block";

    const saveCheckbox = document.getElementById("save-address-checkbox");
    const saveLabel = saveCheckbox?.closest("label");
    if (saveLabel)
      saveLabel.lastChild.textContent = " Update address in profile";
    saveCheckbox.checked = true;
  });
}

// Only call on cart.html
if (window.location.pathname.includes("cart.html")) {
  (async () => {
    // fetch everything in parallel
    const [user, products, variants] = await Promise.all([
      getMe(),
      getProducts(),
      getVariants(),
    ]);

    renderCart(products, variants);

    await checkIfUserHasAddress("address-form", "user-address", user);
    setupAddressEdit(user);
  })();
}

//To validate address inputs
function validateInputs() {
  const name = document.querySelector(".fullname-input");
  const street = document.querySelector(".street-input");
  const city = document.querySelector(".city-input");
  const postalCode = document.querySelector(".postal-code-input");
  const country = document.querySelector(".country-input");

  let emptyFields = [];

  if (!name.value.trim()) {
    emptyFields.push("Name");
    name.style.borderBottom = "1px solid red";
  }
  if (!street.value.trim()) {
    emptyFields.push("Street");
    street.style.borderBottom = "1px solid red";
  }
  if (!city.value.trim()) {
    emptyFields.push("City");
    city.style.borderBottom = "1px solid red";
  }
  if (!postalCode.value.trim()) {
    emptyFields.push("Postal Code");
    postalCode.style.borderBottom = "1px solid red";
  }
  if (!country.value.trim()) {
    emptyFields.push("Country");
    country.style.borderBottom = "1px solid red";
  }

  if (emptyFields.length > 0) {
    const errorMsg = document.querySelector(".cart-error-message");
    errorMsg.classList.add("cart-error-msg");
    errorMsg.innerText = `${emptyFields.join(" & ")} ${emptyFields.length === 1 ? "field is" : "fields are"} empty`;
    return false;
  }
  return true;
}

//Function that runs when confirm purchase button is pressed, creates order in backend
async function createOrder() {
  const user = getCurrentUser();
  const fullUser = await getMe();
  let isValid = true;
  //Only validate form if user has no saved address
  if (!fullUser.address) {
    isValid = validateInputs();
  }
  if (!isValid) return;

  try {
    //Filter cart belonging to user id
    const cart = (JSON.parse(localStorage.getItem("cart")) || []).filter(
      (item) => item.userId === user.userId,
    );
    //Stops function fom running if cart is empty
    if (!cart || cart.length === 0) {
      console.error("Cart is empty");
      return;
    }

    //Get address that is saved for user or from inputs
    let address = null;

    if (fullUser.address && !isEditingAddress) {
      const { _id, __v, ...cleanAddress } = fullUser.address;
      address = {
        name: fullUser.name,
        ...cleanAddress,
      };
    } else {
      address = {
        name: document.querySelector(".fullname-input").value,
        street: document.querySelector(".street-input").value,
        city: document.querySelector(".city-input").value,
        postalCode: document.querySelector(".postal-code-input").value,
        country: document.querySelector(".country-input").value,
      };

      const saveCheckbox = document.getElementById("save-address-checkbox");
      if (saveCheckbox && saveCheckbox.checked) {
        await updateUser({
          name: document.querySelector(".fullname-input").value,
          email: fullUser.email,
          address: {
            street: address.street,
            city: address.city,
            postalCode: address.postalCode,
            country: address.country,
          },
        });
      }
    }

    const order = {
      products: cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: 1,
      })),
      address,
    };

    console.log("Sending address:", JSON.stringify(address));
    console.log("Full user address:", JSON.stringify(fullUser.address));
    const result = await postOrder(order);

    if (!result) {
      console.error("Order failed");
      return;
    }

    console.log("Order success");

    //Clear Cart
    const existingCart = JSON.parse(localStorage.getItem("cart")) || [];
    const updatedCart = existingCart.filter(
      (item) => item.userId !== user.userId,
    );
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    renderCart();
    updateCartBadge();
    summaryModal(result);
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err.message);
    console.error(err);
  }
}

const confirmPurchaseBtn = document.querySelector(".confirm-btn");
confirmPurchaseBtn.addEventListener("click", (e) => {
  e.preventDefault();
  createOrder();
});

//Create modal to show order summary
function summaryModal(order) {
  const background = document.createElement("div");
  background.classList.add("order-modal-background");

  const modal = document.createElement("div");
  modal.classList.add("order-modal");

  // Header
  const header = document.createElement("div");
  header.classList.add("order-modal__header");

  const title = document.createElement("h2");
  title.classList.add("order-modal__title");
  title.innerText = "Order Confirmed";

  const subtitle = document.createElement("p");
  subtitle.classList.add("order-modal__subtitle");
  subtitle.innerText = `Order #${order._id}`;

  const date = document.createElement("p");
  date.classList.add("order-modal__date");
  date.innerText = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const printBtn = document.createElement("button");
  printBtn.classList.add("order-modal__print");
  printBtn.innerText = "Print";
  printBtn.title = "Print Receipt";
  printBtn.addEventListener("click", () => window.print());

  const closeBtn = document.createElement("button");
  closeBtn.classList.add("order-modal__close");
  closeBtn.innerText = "✕";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", () => background.remove());

  header.append(title, subtitle, date, printBtn, closeBtn);

  // Customer info
  const customerSection = document.createElement("div");
  customerSection.classList.add("order-modal__section");

  const customerLabel = document.createElement("p");
  customerLabel.classList.add("order-modal__label");
  customerLabel.innerText = "Shipping to";

  const customerName = document.createElement("p");
  customerName.classList.add("order-modal__value");
  customerName.innerText = order.user.name;

  const addr = order.user.address;
  const customerAddress = document.createElement("p");
  customerAddress.classList.add("order-modal__address");
  customerAddress.innerText = `${addr.street}, ${addr.city}, ${addr.postalCode}, ${addr.country}`;

  customerSection.append(customerLabel, customerName, customerAddress);

  // Products
  const productsSection = document.createElement("div");
  productsSection.classList.add("order-modal__section");

  const productsLabel = document.createElement("p");
  productsLabel.classList.add("order-modal__label");
  productsLabel.innerText = "Items";

  productsSection.append(productsLabel);

  order.products.forEach((product) => {
    const productCard = document.createElement("div");
    productCard.classList.add("order-modal__product");

    const productName = document.createElement("span");
    productName.classList.add("order-modal__product-name");
    productName.innerText = product.name;

    const productSize = document.createElement("span");
    productSize.classList.add("order-modal__product-size");
    productSize.innerText = `Size ${product.size}`;

    const productPrice = document.createElement("span");
    productPrice.classList.add("order-modal__product-price");
    productPrice.innerText = `$${product.price}`;

    productCard.append(productName, productSize, productPrice);
    productsSection.append(productCard);
  });

  // Total
  const totalSection = document.createElement("div");
  totalSection.classList.add("order-modal__total");

  const totalLabel = document.createElement("span");
  totalLabel.innerText = "Total";

  const totalAmount = document.createElement("span");
  totalAmount.classList.add("order-modal__total-amount");
  totalAmount.innerText = `$${order.totalCost.toFixed(2)}`;

  totalSection.append(totalLabel, totalAmount);

  modal.append(header, customerSection, productsSection, totalSection);
  background.append(modal);
  document.body.append(background);

  background.addEventListener("click", (e) => {
    if (e.target === background) background.remove();
  });
}
