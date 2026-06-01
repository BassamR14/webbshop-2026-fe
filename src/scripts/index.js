import { getProducts } from "../utils/api.js";
import { goToProduct } from "./product-detail.js";
import {
  formatDateISO,
  countdownTimer,
  updateCartBadge,
} from "../utils/utility.js";

updateCartBadge();

document.addEventListener("DOMContentLoaded", loadProducts);
const activeFilters = new Set();
//Cache for SSR so SSE handlers can mutate them without re-fetching
let allProducts = [];

function getLatestDrops(products) {
  return products.filter(
    (product) => product.status === "live" || product.status === "upcoming",
  );
}

//SSE Function - opens a persistent one-way connection from the server to the browser at /products/events.
//The server can then push events at any time without the client polling.
function connectSSE() {
  const es = new EventSource(
    "https://webbshop-2026-be.vercel.app/products/events",
  );

  es.onmessage = (e) => {
    //SSE Transmits data as a string, backend is sending data as an unnamed message event, not a named SSE event
    const data = JSON.parse(e.data);

    if (data.type === "product-created") {
      allProducts.push(data.product);
      rerenderProducts();
    } else if (data.type === "product-updated") {
      allProducts = allProducts.map((p) =>
        p._id === data.product._id ? data.product : p,
      );
      rerenderProducts();
    } else if (data.type === "product-deleted") {
      allProducts = allProducts.filter((p) => p._id !== data.productId);
      rerenderProducts();
    } else if (data.type === "product-sold-out") {
      allProducts = allProducts.map((p) =>
        p._id === data.product._id ? { ...p, status: "sold_out" } : p,
      );
      rerenderProducts();
    } else if (data.type === "product-published") {
      allProducts = allProducts.map((p) =>
        p._id === data.product._id ? { ...p, status: "live" } : p,
      );
      rerenderProducts();
    }
  };

  es.onerror = () => {
    console.warn("SSE connection lost, browser will retry…");
  };
}

//Re-render function that runs after SSE
function rerenderProducts() {
  const productsContainer = document.getElementById("products");
  const searchInput = document.querySelector("#product-search");
  const searchValue = searchInput?.value?.toLowerCase() || "";

  let toRender = document.getElementById("hero-product-image")
    ? getLatestDrops(allProducts)
    : allProducts;

  if (searchValue) {
    toRender = toRender.filter((p) =>
      p.name.toLowerCase().includes(searchValue),
    );
  }

  toRender = toRender.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  toRender = applyFilters(toRender);

  productsContainer.innerHTML = "";

  if (toRender.length === 0) {
    const msg = document.createElement("p");
    msg.textContent = searchValue ? "No Products Found" : "No products yet.";
    productsContainer.appendChild(msg);
    return;
  }

  toRender.forEach((product) => {
    productsContainer.appendChild(createProductCard(product));
  });
}

// Fetch products from API, fallback to temp data if unavailable
async function loadProducts() {
  const productsContainer = document.getElementById("products");
  productsContainer.innerHTML = "<p>Loading products...</p>";

  try {
    const products = await getProducts();
    //Save Products in SSE cache
    allProducts = products;
    productsContainer.innerHTML = "";

    const nextDrop = getNextDrop(allProducts);
    const heroImage = document.getElementById("hero-product-image");
    const heroName = document.getElementById("hero-product-name");
    const heroTimer = document.getElementById("hero-product-timer");
    const heroBtn = document.getElementById("hero-btn");

    //Search product catalogue
    const searchInput = document.querySelector("#product-search");

    //Search + debounder functions, runs only if there is a search input
    if (searchInput) {
      function searchCatalogue() {
        const searchValue = searchInput.value;

        //If empty
        if (!searchValue) {
          productsContainer.innerHTML = "";
          applyFilters(allProducts).forEach((product) => {
            const card = createProductCard(product);
            productsContainer.appendChild(card);
          });
          return;
        }

        let filteredProducts = allProducts.filter((p) =>
          p.name.toLowerCase().includes(searchValue.toLowerCase()),
        );

        filteredProducts = filteredProducts.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );

        filteredProducts = applyFilters(filteredProducts);

        productsContainer.innerHTML = "";

        //If no products match
        if (filteredProducts.length === 0) {
          const message = document.createElement("p");
          message.innerText = "No Products Found";
          productsContainer.append(message);
          return;
        }

        filteredProducts.forEach((product) => {
          const card = createProductCard(product);
          productsContainer.appendChild(card);
        });
      }

      //debounce (limit on how often a function fires)
      function debounce(fn, delay) {
        //Store timer to be able cancel previous timers
        let timeout;

        return () => {
          //clear previous timer
          clearTimeout(timeout);
          //start new timer
          timeout = setTimeout(fn, delay);
        };
      }

      //Debounce + Search event listener
      const debouncedSearch = debounce(searchCatalogue, 300);
      searchInput.addEventListener("input", debouncedSearch);
    }

    let toRender;
    if (heroImage) {
      toRender = getLatestDrops(allProducts);
    } else {
      toRender = allProducts;
    }

    toRender = toRender.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    //Apply active status filters to all products products
    const filteredProducts = applyFilters(toRender);

    filteredProducts.forEach((product) => {
      const card = createProductCard(product);
      productsContainer.appendChild(card);
    });

    //Filter buttons
    const upcomingBtn = document.querySelector(".upcoming-btn");
    const liveBtn = document.querySelector(".live-btn");
    const soldOutBtn = document.querySelector(".soldOut-btn");

    //Toggle filter function (which status, which button)
    function toggleFilter(filter, button) {
      if (activeFilters.has(filter)) {
        activeFilters.delete(filter);
        button.classList.remove("active");
      } else {
        activeFilters.add(filter);
        button.classList.add("active");
      }

      //Re-trigger search (this re-renders everything)
      if (searchInput) {
        searchInput.dispatchEvent(new Event("input"));
      } else {
        // fallback (no search field)
        productsContainer.innerHTML = "";
        applyFilters(allProducts).forEach((product) => {
          const card = createProductCard(product);
          productsContainer.appendChild(card);
        });
      }
    }

    upcomingBtn?.addEventListener("click", () =>
      toggleFilter("upcoming", upcomingBtn),
    );

    liveBtn?.addEventListener("click", () => toggleFilter("live", liveBtn));

    soldOutBtn?.addEventListener("click", () =>
      toggleFilter("sold_out", soldOutBtn),
    );

    if (nextDrop && heroImage) {
      heroImage.style.display = "block";
      document.querySelector(".hero-product").classList.remove("hero-product--empty");
      renderHero(nextDrop);
    } else if (heroImage) {
      heroImage.style.display = "none";
      document.querySelector(".hero-product").classList.add("hero-product--empty");
      heroName.textContent = "No upcoming drops";
      heroTimer.textContent = "Check back soon!";
      heroBtn.textContent = "Shop Latest Drop"; 
      heroBtn.addEventListener("click", () => {
        window.location.href = "products.html";
      });
    }

    //Start SSE after first render
    connectSSE();
  } catch (error) {
    console.error("Error fetching products:", error);
    productsContainer.innerHTML =
      "<p>Could not load products. Please try again later</p>";
  }
}

//Filter Helper Function
function applyFilters(products) {
  //Return All if no filter is chosen
  if (activeFilters.size === 0) return products;

  return products.filter((product) => activeFilters.has(product.status));
}

// Function to create an individual product card
function createProductCard(product) {
  const element = document.createElement("div");
  element.className = "product-card";

  const imageSection = document.createElement("div");
  imageSection.className = "image-wrapper";

  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.textContent = product.status;

  if (product.status === "live") {
    badge.classList.add("status-badge--live");
  } else if (product.status === "upcoming") {
    badge.classList.add("status-badge--upcoming");
  } else {
    badge.classList.add("status-badge--sold-out");
  }

  imageSection.appendChild(badge);

  if (product.image) {
    const image = document.createElement("img");
    image.className = "product-card__image";
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";

    imageSection.appendChild(image);
  } else {
    const image = document.createElement("div");
    image.className = "product-card__image-placeholder";
    image.textContent = "👟";

    imageSection.appendChild(image);
  }

  let statusElement;

  if (product.status === "upcoming") {
    statusElement = document.createElement("p");
    statusElement.className = "drop-timer";
    //Add timer to product card
    countdownTimer(product.dropDate, statusElement);
  } else if (product.status === "live") {
    statusElement = document.createElement("button");
    statusElement.className = "status-btn";
    statusElement.textContent = `Buy Now`;
  } else {
    statusElement = document.createElement("button");
    statusElement.className = "status-btn";
    statusElement.disabled = true;
    statusElement.textContent = `Sold Out`;
  }

  const productCard = document.createElement("div");
  productCard.className = "product-card__body";

  const h3 = document.createElement("h3");
  h3.textContent = product.name;
  const p = document.createElement("p");
  p.className = "product-card__price";
  p.textContent = `$${product.price.toFixed(2)}`;
  productCard.appendChild(h3);
  productCard.appendChild(p);
  productCard.appendChild(statusElement);

  element.appendChild(imageSection);
  element.appendChild(productCard);

  //Navigates to the product detail page
  element.addEventListener("click", () => goToProduct(product._id));

  return element;
}

function renderHero(product) {
  const heroProductImage = document.getElementById("hero-product-image");
  const heroProductName = document.getElementById("hero-product-name");
  const heroProductTimer = document.getElementById("hero-product-timer");

  heroProductImage.src = product.image;
  heroProductName.textContent = product.name;
  //Hero Timer
  countdownTimer(product.dropDate, heroProductTimer);

  heroBtn.textContent = "Shop the Drop"; // reset text in case it was changed to "Shop Latest Drop" when there were no upcoming drops
  heroBtn.removeAttribute("href");       // remove href in case it was set to "products.html" when there were no upcoming drops

  heroBtn.addEventListener("click", () => goToProduct(product._id));
}

function getNextDrop(products) {
  let upcomingDrops = products.filter(
    (product) => product.status === "upcoming",
  );

  let nextDrop = upcomingDrops.sort(
    (a, b) => new Date(a.dropDate) - new Date(b.dropDate),
  )[0];

  return nextDrop;
}
