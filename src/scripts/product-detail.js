import { getProduct, getVariants, getMe } from "../utils/api.js";
import {
  formatDateISO,
  countdownTimer,
  addToCart,
  addToWishlist,
  updateCartBadge,
} from "../utils/utility.js";

let selectedSize = null;

//Takes you to the product detail page and adding the product Id as a param
export function goToProduct(productId) {
  window.location.href = `product-detail.html?id=${productId}`;
}

export async function renderProductDetail() {
  //get the id from the params
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  let currentUser = null;
  let wishlist = [];

  try {
    const product = await getProduct(productId);
    const allVariants = await getVariants();
    const variants = allVariants.filter((v) => v.productId === productId);

    const user = await getMe();
    wishlist = user?.wishlist ?? [];

    //run breadcrumb function
    renderBreadcrumbs(product);

    //render all product information
    const image = document.querySelector(".pd-image");
    image.src = product.image;
    image.alt = product.name;

    //Timer
    const timer = document.querySelector(".pd-timer");
    countdownTimer(product.dropDate, timer);

    const releaseDate = document.querySelector(".release-data");
    const date = formatDateISO(product.dropDate);
    releaseDate.textContent = `Release Date: ${date}`;
    const status = document.querySelector(".pd-status");
    status.textContent = product.status;
    const name = document.querySelector(".pd-name");
    name.textContent = product.name;
    const description = document.querySelector(".pd-description");
    description.textContent = product.description;
    const price = document.querySelector(".pd-price");
    price.textContent = `$${product.price}`;
    const sizes = document.querySelector(".pd-sizes");
    const addToCartBtn = document.querySelector(".add-to-cart");
    //Add to cart button starts disabled
    addToCartBtn.disabled = true;

    const addToWishlistBtn = document.querySelector(".add-to-wishlist");

    if (product.status === "sold_out") {
      addToWishlistBtn.disabled = true;
    }

    // Helper to update Add to Cart button state
    function updateAddToCartState() {
      const activeSizeSelected = !!document.querySelector(
        ".pd-sizes button.active",
      );
      const anyStockAvailable = Array.from(sizes.children).some(
        (btn) => !btn.disabled,
      );
      const productIsLive = product.status.toLowerCase() === "live";

      // Button is enabled only if all three conditions are true
      addToCartBtn.disabled = !(
        activeSizeSelected &&
        anyStockAvailable &&
        productIsLive
      );
    }

    variants.sort((a, b) => Number(a.size) - Number(b.size));

    //Create a button for each size
    variants.forEach((v) => {
      const button = document.createElement("button");
      button.innerText = v.size;
      if (v.stock === 0) {
        button.disabled = true;
      }

      //Check product status
      if (product.status === "sold_out") {
        button.disabled = true;
      }

      //A button press saves the size that is pressed, becomes active visually so user knows which button is pressed, if another button is pressed, active is removed from all other buttons.
      button.addEventListener("click", () => {
        selectedSize = Number(v.size);

        Array.from(sizes.children).forEach((btn) =>
          btn.classList.remove("active"),
        );
        button.classList.add("active");

        // Update Add to Cart state whenever a size is clicked
        updateAddToCartState();

        //Erases error/success message
        const message = document.querySelector(".cart-message");
        message.innerText = "";

        //Update button state is variant size is wishlisted
        const selectedVariant = variants.find(
          (v) => Number(v.size) === Number(selectedSize),
        );
        updateWishlistState(selectedVariant);
      });

      sizes.append(button);
    });

    updateAddToCartState();

    //add to cart event listener
    addToCartBtn.addEventListener("click", () => {
      const selectedVariant = variants.find(
        (v) => Number(v.size) === Number(selectedSize),
      );

      //Runs add to cart function with arguments product Id and size
      const result = addToCart(product._id, selectedVariant._id, selectedSize);

      //Error & Success messaging/actions
      if (!result.success) {
        switch (result.error) {
          case "not_logged_in":
            window.location.href = "auth.html";
            break;
          case "duplicate_size":
            const message = document.querySelector(".cart-message");
            message.textContent = "You can only add one of each size!";
            message.style.color = "red";
            break;
        }
      } else {
        const message = document.querySelector(".cart-message");
        message.textContent = "Item added to cart!";
        message.style.color = "green";
        updateCartBadge();
      }
    });

    //add to wishlist event listener
    addToWishlistBtn.addEventListener("click", async () => {
      const selectedVariant = variants.find(
        (v) => Number(v.size) === Number(selectedSize),
      );

      if (!selectedVariant) {
        const message = document.querySelector(".cart-message");
        message.textContent = "Please select a size first!";
        message.style.color = "red";
        return;
      }

      // Get latest user wishlist from backend
      currentUser = await getMe();
      if (!currentUser) {
        window.location.href = "auth.html";
        return;
      }

      wishlist = currentUser?.wishlist || [];

      //Duplicate check
      const alreadyExists = wishlist.some(
        (item) =>
          item.product === product._id && item.variant === selectedVariant._id,
      );

      if (alreadyExists) {
        const message = document.querySelector(".cart-message");
        message.textContent = "You already have this size in your wishlist!";
        message.style.color = "red";
        return;
      }

      const result = await addToWishlist(product._id, selectedVariant._id);
      if (result.success) {
        wishlist.push({
          product: product._id,
          variant: selectedVariant._id,
        });
      }

      const message = document.querySelector(".cart-message");

      if (!result.success) {
        if (result.error === "not_logged_in") {
          window.location.href = "auth.html";
          return;
        }

        message.textContent = "Something went wrong!";
        message.style.color = "red";
        return;
      }

      message.textContent = "Added to wishlist!";
      message.style.color = "green";

      // refresh UI state
      updateWishlistState(selectedVariant);
    });

    //monitors and updates wishlist state
    async function updateWishlistState(selectedVariant) {
      if (!selectedVariant) {
        addToWishlistBtn.textContent = "Add to Wishlist";
        addToWishlistBtn.classList.remove("active");
        return;
      }

      const isWishlisted = wishlist.some(
        (item) =>
          item.product === product._id && item.variant === selectedVariant._id,
      );

      addToWishlistBtn.textContent = isWishlisted
        ? "Wishlisted"
        : "Add to Wishlist";

      addToWishlistBtn.classList.toggle("active", isWishlisted);

      if (product.status === "sold_out") {
        addToWishlistBtn.disabled = true;
      }
    }
  } catch (error) {
    console.error(error);
  }
}

// Only call on product-detail.html
if (window.location.pathname.includes("product-detail.html")) {
  renderProductDetail();

  document.querySelector(".go-back").addEventListener("click", () => {
    window.location.href = "products.html";
  });
}

//for the breadcrumb navigation
function renderBreadcrumbs(product) {
  const container = document.querySelector(".breadcrumb");
  container.innerHTML = "";

  // Home link
  const homeLink = document.createElement("a");
  homeLink.href = "index.html";
  homeLink.textContent = "Home";
  container.append(homeLink);

  // Separator
  container.append(document.createTextNode(" > "));

  // Products link
  const productsLink = document.createElement("a");
  productsLink.href = "products.html";
  productsLink.textContent = "Products";
  container.append(productsLink);

  // Separator
  container.append(document.createTextNode(" > "));

  // Current product name (not a link)
  const current = document.createElement("span");
  current.textContent = product.name;
  container.append(current);
}
