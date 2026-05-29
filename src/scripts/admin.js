import {
  getProducts,
  getVariants,
  getUsers,
  getOrders,
  addProduct,
  addVariant,
  updateProduct,
  updateVariant,
  deleteVariant,
  updateOrder,
  flagUser,
  deleteProduct,
  getProduct,
} from "../utils/api.js";
import {
  generateObjectId,
  decodeToken,
  updateCartBadge,
} from "../utils/utility.js";

updateCartBadge();

//Guard against manually going to admin page by a user
function checkIfAdmin() {
  const token = localStorage.getItem("token");
  const decodedToken = token ? decodeToken(token) : null;

  if (!token || !decodedToken || decodedToken.isAdmin === false) {
    document.body.innerHTML = "";
    document.body.style.visibility = "visible";

    const msg = document.createElement("h1");
    msg.style.textAlign = "center";
    const img = document.createElement("img");
    msg.innerText = "You Can't be here! Begone!";
    img.src = "lotr.gif";
    document.body.append(msg, img);

    return false;
  }

  // Admin confirmed — reveal the page
  document.body.style.visibility = "visible";
  return true;
}

if (!checkIfAdmin()) throw new Error("Not admin");

let editingProductId = null;

//Function that fetches all data, instead of having to fetch data in each render function
async function fetchData() {
  //All api functions fire at the same time instead of waiting for the previous one to finish.
  const [products, variants, users, orders] = await Promise.all([
    getProducts(),
    getVariants(),
    getUsers(),
    getOrders(),
  ]);

  return { products, variants, users, orders };
}

//Function to view all products
function renderProductTable(products, variants) {
  const productList = document.querySelector(".admin-products-tbody");

  productList.innerHTML = "";

  // variants.forEach((variant) => {
  //   const match = products.find((p) => p._id === variant.productId);
  //   if (!match) {
  //     console.error("Orphaned variant found:", variant);
  //     console.log("Variant productId:", variant.productId);
  //   }
  // });

  // Filter out orphaned variants entirely before sorting
  const validVariants = variants.filter((variant) =>
    products.some((p) => p._id === variant.productId),
  );

  const sortedVariants = [...validVariants].sort((a, b) => {
    const productA = products.find((p) => p._id === a.productId);
    const productB = products.find((p) => p._id === b.productId);

    const nameCompare = productA.name.localeCompare(productB.name);
    if (nameCompare !== 0) return nameCompare;

    return Number(a.size) - Number(b.size);
  });

  sortedVariants.forEach((variant) => {
    const product = products.find((p) => p._id === variant.productId);
    if (!product) return;

    const tr = document.createElement("tr");
    const name = document.createElement("th");
    const price = document.createElement("th");
    const size = document.createElement("th");
    const stock = document.createElement("th");
    const dropStatus = document.createElement("th");
    const actions = document.createElement("th");
    const productActions = document.createElement("th");
    const variantActions = document.createElement("th");

    name.innerText = product.name;
    price.innerText = `$${product.price}`;
    size.innerText = variant.size;
    dropStatus.innerText = product.status;

    // Stock color helper
    const getStockColor = (value) => {
      if (value === 0) return "red";
      else if (value <= 5) return "orange";
      else return "green";
    };

    // Stock span with text color
    const stockText = document.createElement("span");
    stockText.innerText = variant.stock;
    stockText.style.color = getStockColor(variant.stock);
    stock.appendChild(stockText);

    // btn Update stock
    const updateStockBtn = document.createElement("button");
    updateStockBtn.innerText = "Update Stock";
    updateStockBtn.style.backgroundColor = "#DEED00";
    updateStockBtn.style.color = "black";

    let stockInput = null;

    updateStockBtn.addEventListener("click", async () => {
      if (updateStockBtn.innerText.toLowerCase() === "update stock") {
        stockInput = document.createElement("input");
        stockInput.type = "number";
        stockInput.min = "0";
        stockInput.value = parseInt(stockText.innerText);
        stockInput.style.width = "100px";

        stock.replaceChild(stockInput, stockText);
        updateStockBtn.innerText = "Save Stock";
      } else {
        const newStock = parseInt(stockInput.value);

        if (isNaN(newStock) || newStock < 0) {
          alert("Stock must be a non-negative number");
          return;
        }

        const result = await updateVariant(variant._id, { stock: newStock });

        //Guard so that the stock display doesn't change if updatevariant fails
        if (!result) {
          alert("Failed to update stock. Please try again.");
          return;
        }

        stockText.innerText = newStock;
        stockText.style.color = getStockColor(newStock);
        stock.replaceChild(stockText, stockInput);
        updateStockBtn.innerText = "Update Stock";
      }
    });

    // Delete size button
    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "Delete Size";
    deleteBtn.style.backgroundColor = "red";
    deleteBtn.style.color = "white";

    deleteBtn.addEventListener("click", async () => {
      // Check if variant has active orders
      const { orders } = await fetchData();
      const hasActiveOrder = orders.some(
        (o) =>
          o.status !== "cancelled" &&
          o.products.some((p) => p.variantId === variant._id),
      );

      if (hasActiveOrder) {
        alert("Cannot delete this size as it has active orders.");
        return;
      }

      const confirmed = window.confirm(`Delete size ${variant.size}?`);
      if (!confirmed) return;

      await deleteVariant(variant._id);
      tr.remove();
    });

    const statusBtn = document.createElement("button");
    if (product.status === "upcoming") {
      statusBtn.innerText = "Go Live";
      statusBtn.style.backgroundColor = "green";
      statusBtn.style.color = "white";

      statusBtn.addEventListener("click", async () => {
        await updateProduct(product._id, { ...product, status: "live" });
        await onPageLoad();
        dropStatus.innerText = "live";
        statusBtn.innerText = "Mark Sold Out";
        statusBtn.style.backgroundColor = "orange";
      });

      productActions.append(statusBtn);
      variantActions.append(updateStockBtn, deleteBtn);
    } else if (product.status === "live") {
      statusBtn.innerText = "Mark Sold Out";
      statusBtn.style.backgroundColor = "orange";
      statusBtn.style.color = "white";

      statusBtn.addEventListener("click", async () => {
        await updateProduct(product._id, {
          ...product,
          status: "sold_out",
        });
        await onPageLoad();
        product.status = "sold out";
        dropStatus.innerText = "sold out";
        statusBtn.innerText = "Go Live";
        statusBtn.style.backgroundColor = "green";
      });

      productActions.append(statusBtn);
      variantActions.append(updateStockBtn, deleteBtn);
    } else {
      // sold out — show Go Live button
      statusBtn.innerText = "Go Live";
      statusBtn.style.backgroundColor = "green";
      statusBtn.style.color = "white";

      // Only allow going live if there's stock
      statusBtn.addEventListener("click", async () => {
        const totalStock = variants
          .filter((v) => v.productId === product._id)
          .reduce((sum, v) => sum + Number(v.stock), 0);

        if (totalStock === 0) {
          alert("Cannot go live. Product has no stock.");
          return;
        }

        await updateProduct(product._id, { ...product, status: "live" });
        await onPageLoad();
        product.status = "live";
        dropStatus.innerText = "live";
        statusBtn.innerText = "Mark Sold Out";
        statusBtn.style.backgroundColor = "orange";
      });

      productActions.append(statusBtn);
      variantActions.append(updateStockBtn, deleteBtn);
    }

    // Row clickable — show product detail modal
    tr.style.cursor = "pointer";

    tr.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;

      const modal = document.querySelector("#product-detail-modal");
      const modalVariants = document.querySelector("#modal-product-variants");

      modalVariants.innerHTML = "";

      const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      };

      document.querySelector("#modal-product-name").innerText = product.name;
      document.querySelector("#modal-product-status").innerText =
        product.status;
      document.querySelector("#modal-product-price").innerText =
        `$${product.price}`;
      document.querySelector("#modal-product-description").innerText =
        product.description;
      document.querySelector("#modal-product-dropdate").innerText = formatDate(
        product.dropDate,
      );
      document.querySelector("#modal-product-image").src =
        product.image || "https://placehold.co/120x120";

      // show details for this product
      const productVariants = variants.filter(
        (v) => v.productId === product._id,
      );
      productVariants.forEach((v) => {
        const tr = document.createElement("tr");
        const size = document.createElement("th");
        const stock = document.createElement("th");

        size.innerText = v.size;
        stock.innerText = v.stock;
        stock.style.color = getStockColor(v.stock);

        tr.append(size, stock);
        modalVariants.append(tr);
      });

      modal.style.display = "flex";
    });

    tr.append(
      name,
      price,
      size,
      stock,
      dropStatus,
      productActions,
      variantActions,
    );
    productList.append(tr);
  });
}

//function to view all users
function renderUserTable(users, orders, products) {
  const userList = document.querySelector(".admin-user-tbody");
  userList.innerHTML = "";

  const onlyUsers = users.filter((u) => u.isAdmin === false);

  onlyUsers.forEach((user) => {
    const userOrders = orders.filter((o) => o.user?.id === user._id);

    const tr = document.createElement("tr");
    tr.dataset.userId = user._id;
    const name = document.createElement("th");
    const email = document.createElement("th");
    const numOfOrders = document.createElement("th");
    const numOfWishlists = document.createElement("th");
    const Actions = document.createElement("th");

    name.innerText = user.isFlagged ? `🚩 ${user.name}` : user.name;
    email.innerText = user.email;
    numOfOrders.innerText = userOrders.length;

    const validWishlistCount =
      user.wishlist?.filter((item) =>
        products.some((p) => p._id === item.product),
      ).length ?? 0;

    numOfWishlists.innerText = validWishlistCount;

    if (user.isFlagged) {
      tr.style.backgroundColor = "#ffe0e0";
    }

    const flagBtn = document.createElement("button");
    flagBtn.innerText = user.isFlagged ? "Unflag" : "Flag";
    flagBtn.style.backgroundColor = user.isFlagged ? "gray" : "red";
    flagBtn.style.color = "white";

    const viewOrdersBtn = document.createElement("button");
    viewOrdersBtn.innerText = "Order History";

    viewOrdersBtn.addEventListener("click", () => {
      const modal = document.querySelector("#user-orders-modal");
      const modalUserName = document.querySelector("#modal-user-name");
      const modalAddress = document.querySelector("#modal-user-address");
      const modalTbody = document.querySelector("#modal-order-tbody");

      modalUserName.innerText = `${user.name}'s Order History`;
      modalTbody.innerHTML = "";

      // address
      const address = user.address;
      if (address) {
        modalAddress.innerText = `${address.street}, ${address.city}, ${address.postalCode}, ${address.country}`;
      } else {
        modalAddress.innerText = "No address on file";
      }

      const userOrders = orders.filter((o) => o.user?.id === user._id);

      if (userOrders.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.innerText = "No orders found.";
        td.style.textAlign = "center";
        tr.append(td);
        modalTbody.append(tr);
      } else {
        userOrders.forEach((order) => {
          order.products.forEach((product) => {
            const tr = document.createElement("tr");
            const img = document.createElement("th");
            let orderId = document.createElement("th");
            const productName = document.createElement("th");
            const size = document.createElement("th");
            const price = document.createElement("th");
            const status = document.createElement("th");
            const date = document.createElement("th");

            const imgEl = document.createElement("img");
            imgEl.src = product.image || "https://placehold.co/50x50";
            imgEl.style.width = "50px";
            imgEl.style.height = "50px";
            imgEl.style.objectFit = "cover";
            img.appendChild(imgEl);

            orderId.innerText = order._id;
            productName.innerText = product.name;
            size.innerText = product.size;
            price.innerText = `$${product.price}`;
            status.innerText = order.status;
            date.innerText = new Date(order.createdAt).toLocaleDateString();

            tr.append(img, orderId, productName, size, price, status, date);
            modalTbody.append(tr);
          });
        });
      }

      modal.style.display = "flex";
    });

    //Assuming this is old code, but didn't know if i should remove it
    // // Close modal
    // document.querySelector("#close-modal-btn").addEventListener("click", () => {
    //   document.querySelector("#user-orders-modal").style.display = "none";
    // });

    // // Close modal when clicking outside
    // document
    //   .querySelector("#user-orders-modal")
    //   .addEventListener("click", (e) => {
    //     if (e.target._id === "user-orders-modal") {
    //       document.querySelector("#user-orders-modal").style.display = "none";
    //     }
    //   });
    // // Print modal
    // document.querySelector("#print-modal-btn").addEventListener("click", () => {
    //   window.print();
    // });

    // Actions.append(viewOrdersBtn, flagBtn);

    // tr.append(name, email, numOfOrders, Actions);
    //   document.body.classList.add("modal-open");

    // });

    Actions.append(viewOrdersBtn, flagBtn);

    tr.append(name, email, numOfOrders, numOfWishlists, Actions);
    userList.append(tr);
  });
}

//function to view all orders
function renderOrderTable(products, users, orders) {
  const orderList = document.querySelector(".admin-order-tbody");

  // filter logic
  const customerFilter = document
    .querySelector("#filter-customer")
    .value.toLowerCase();
  const productFilter = document
    .querySelector("#filter-product")
    .value.toLowerCase();
  const statusFilter = document.querySelector("#filter-status").value;
  const dateFrom = document.querySelector("#filter-date-from").value;
  const dateTo = document.querySelector("#filter-date-to").value;

  const filteredOrders = orders.filter((order) => {
    const productItems = Array.isArray(order.products)
      ? order.products
      : [order.products];

    const orderUser = users.find((u) => u._id === order.user?.id);
    console.log(order._id, order.user?.id, orderUser);

    if (!orderUser) return false;

    const matchCustomer =
      orderUser?.name.toLowerCase().includes(customerFilter) ?? true;
    const matchProduct = productItems.some((item) => {
      const product = products.find((p) => p._id === item.productId);
      // orders with deleted products still show up
      if (!product) return true;
      return product?.name.toLowerCase().includes(productFilter);
    });
    const matchStatus = statusFilter === "" || order.status === statusFilter;

    const orderDate = new Date(order.createdAt).toISOString().slice(0, 10);
    const matchDateFrom = dateFrom === "" || orderDate >= dateFrom;
    const matchDateTo = dateTo === "" || orderDate <= dateTo;

    return (
      matchCustomer &&
      matchProduct &&
      matchStatus &&
      matchDateFrom &&
      matchDateTo
    );
  });

  orderList.innerHTML = "";

  const orderCount = document.querySelector("#order-count");
  if (orderCount) {
    orderCount.innerText = `Showing ${filteredOrders.length} orders`;
  }

  filteredOrders.forEach((order) => {
    //To show product information later
    // const productItems = Array.isArray(order.products)
    //   ? order.products
    //   : [order.products];

    // productItems.forEach((item) => {
    //   const product = products.find((p) => p._id === item.productId);
    // });

    const orderUser = users.find((u) => u._id === order.user?.id);
    if (!orderUser) return false;

    const tr = document.createElement("tr");
    const orderId = document.createElement("th");
    const userName = document.createElement("th");
    const numOfItems = document.createElement("th");
    const price = document.createElement("th");
    const date = document.createElement("th");
    const status = document.createElement("th");
    const Actions = document.createElement("th");

    orderId.innerText = order._id;
    userName.innerText = orderUser.name;
    numOfItems.innerText = order.numOfItems;
    price.innerText = `$${order.totalCost}`;
    date.innerText = new Date(order.createdAt).toLocaleDateString();
    status.innerText = order.status;

    const viewOrderBtn = document.createElement("button");
    viewOrderBtn.innerText = "Order Detail";

    viewOrderBtn.addEventListener("click", () => {
      const modal = document.querySelector("#order-detail-modal");
      const modalTbody = document.querySelector("#modal-order-products");

      modalTbody.innerHTML = "";

      document.querySelector("#modal-order-id").innerText =
        `Order #${order._id}`;
      document.querySelector("#modal-order-date").innerText = new Date(
        order.createdAt,
      ).toLocaleDateString();
      document.querySelector("#modal-order-customer").innerText =
        order.user.name;
      document.querySelector("#modal-order-status").innerText = order.status;
      document.querySelector("#modal-order-total").innerText =
        `$${order.totalCost}`;

      const address = order.user.address;
      document.querySelector("#modal-order-address").innerText = address
        ? `${address.street}, ${address.city}, ${address.postal_code}, ${address.country}`
        : "No address on file";

      order.products.forEach((product) => {
        const tr = document.createElement("tr");
        const productName = document.createElement("th");
        const size = document.createElement("th");
        const price = document.createElement("th");

        productName.innerText = product.name;
        size.innerText = product.size;
        price.innerText = `$${product.price}`;

        tr.append(productName, size, price);
        modalTbody.append(tr);
      });

      modal.style.display = "flex";
      document.body.classList.add("modal-open");
    });

    const updateStatusBtn = document.createElement("button");
    updateStatusBtn.innerText = "Update Status";
    updateStatusBtn.classList.add("btn-update-status");

    updateStatusBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      // create dropdown for changing order status
      const validStatuses = [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ];
      const currentStatus = status.innerText;

      const select = document.createElement("select");
      validStatuses.forEach((s) => {
        const option = document.createElement("option");
        option.value = s;
        option.innerText = s.charAt(0).toUpperCase() + s.slice(1);
        if (s === currentStatus) option.selected = true;
        select.append(option);
      });

      const saveBtn = document.createElement("button");
      saveBtn.innerText = "Save";
      saveBtn.classList.add("save-status-btn");

      // replace dropdown + save
      updateStatusBtn.replaceWith(select);
      select.after(saveBtn);
      select.classList.add("status-select");

      saveBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const newStatus = select.value;

        if (newStatus === currentStatus) {
          select.replaceWith(updateStatusBtn);
          saveBtn.remove();
          return;
        }

        // confirm status delivered and cancelled because they are irreversible
        if (newStatus === "delivered" || newStatus === "cancelled") {
          const confirmed = window.confirm(
            `Are you sure you want to mark this order as "${newStatus}"?`,
          );
          if (!confirmed) return;
        }

        const result = await updateOrder(order._id, { status: newStatus });

        if (result) {
          status.innerText = newStatus;
          order.status = newStatus;
          select.replaceWith(updateStatusBtn);
          saveBtn.remove();
          alert(`Order status updated to ${newStatus}.`);
        } else {
          alert("Failed to update order status. Please try again.");
          select.replaceWith(updateStatusBtn);
          saveBtn.remove();
        }
      });
    });

    Actions.append(viewOrderBtn, updateStatusBtn);

    tr.append(orderId, date, userName, numOfItems, price, status, Actions);
    orderList.append(tr);
  });
}

//Function that shows stats
function renderStats(products, orders) {
  const revenue = orders.reduce((sum, order) => {
    return sum + order.totalCost;
  }, 0);
  const activeProducts = products.filter((p) => p.status === "live");
  const shipped = orders.filter((o) => o.status === "shipped");
  const pending = orders.filter((o) => o.status === "pending");

  const totalRevenue = document.querySelector(".stat-revenue");
  const activeDrops = document.querySelector(".stat-active-drops");
  const totalOrders = document.querySelector(".stat-total-orders");
  const shippedOrders = document.querySelector(".stat-shipped-orders");
  const pendingOrders = document.querySelector(".stat-pending-orders");

  totalRevenue.innerText = `$ ${revenue.toFixed(2)}`;
  activeDrops.innerText = activeProducts.length;
  totalOrders.innerText = orders.length;
  shippedOrders.innerText = shipped.length;
  pendingOrders.innerText = pending.length;
}

//Fetches all data and runs render functions when the page loads
async function onPageLoad() {
  const { products, variants, users, orders } = await fetchData();

  renderProductTable(products, variants);
  renderUserTable(users, orders, products);
  renderOrderTable(products, users, orders);
  renderStats(products, orders);
  renderProductSelect(products);
}

onPageLoad();

// Close product detail modal
document
  .querySelector("#close-product-modal-btn")
  .addEventListener("click", () => {
    document.querySelector("#product-detail-modal").style.display = "none";
  });

document
  .querySelector("#product-detail-modal")
  .addEventListener("click", (e) => {
    if (e.target.id === "product-detail-modal") {
      document.querySelector("#product-detail-modal").style.display = "none";
    }
  });

const cancelEditBtn = document.querySelector("#cancel-edit-btn");
cancelEditBtn.addEventListener("click", (e) => {
  e.preventDefault();
  cancelEdit();
});

// Close order detail modal
document
  .querySelector("#close-order-modal-btn")
  .addEventListener("click", () => {
    document.querySelector("#order-detail-modal").style.display = "none";
    document.body.classList.remove("modal-open");
  });

document.querySelector("#order-detail-modal").addEventListener("click", (e) => {
  if (e.target.id === "order-detail-modal") {
    document.querySelector("#order-detail-modal").style.display = "none";
    document.body.classList.remove("modal-open");
  }
});

document
  .querySelector("#print-order-modal-btn")
  .addEventListener("click", () => {
    window.print();
  });

// Close user order history modal
document.querySelector("#close-modal-btn").addEventListener("click", () => {
  document.querySelector("#user-orders-modal").style.display = "none";
  document.body.classList.remove("modal-open");
});

document.querySelector("#user-orders-modal").addEventListener("click", (e) => {
  if (e.target.id === "user-orders-modal") {
    document.querySelector("#user-orders-modal").style.display = "none";
    document.body.classList.remove("modal-open");
  }
});

document.querySelector("#print-modal-btn").addEventListener("click", () => {
  window.print();
});

document
  .querySelector(".admin-user-tbody")
  .addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.target.innerText.toLowerCase() !== "flag" &&
      e.target.innerText.toLowerCase() !== "unflag"
    )
      return;

    // find the user id and current flag status
    const flagBtn = e.target;
    const tr = flagBtn.closest("tr");
    const nameCell = tr.querySelector("th:nth-child(1)");
    const isFlagged = flagBtn.innerText.toLowerCase() === "unflag";
    const userId = tr.dataset.userId;

    try {
      await flagUser(userId, !isFlagged);
      flagBtn.innerText = !isFlagged ? "Unflag" : "Flag";
      flagBtn.style.backgroundColor = !isFlagged ? "gray" : "red";
      tr.style.backgroundColor = !isFlagged ? "#ffe0e0" : "";
      nameCell.innerText = !isFlagged
        ? `🚩 ${nameCell.innerText}`
        : nameCell.innerText.replace("🚩 ", "");
    } catch (error) {
      alert("Failed to flag account. Please try again.");
    }
  });

// Filter listeners — outside onPageLoad to avoid re-attaching on every reload
document
  .querySelector("#filter-customer")
  .addEventListener("input", async () => {
    const { products, variants, users, orders } = await fetchData();
    renderOrderTable(products, users, orders);
  });

document
  .querySelector("#filter-product")
  .addEventListener("input", async () => {
    const { products, users, orders } = await fetchData();
    renderOrderTable(products, users, orders);
  });

document
  .querySelector("#filter-status")
  .addEventListener("change", async () => {
    const { products, users, orders } = await fetchData();
    renderOrderTable(products, users, orders);
  });

document
  .querySelector("#filter-date-from")
  .addEventListener("change", async () => {
    const { products, users, orders } = await fetchData();
    renderOrderTable(products, users, orders);
  });

document
  .querySelector("#filter-date-to")
  .addEventListener("change", async () => {
    const { products, users, orders } = await fetchData();
    renderOrderTable(products, users, orders);
  });

document
  .querySelector("#clear-filters-btn")
  .addEventListener("click", async () => {
    document.querySelector("#filter-customer").value = "";
    document.querySelector("#filter-product").value = "";
    document.querySelector("#filter-date-from").value = "";
    document.querySelector("#filter-date-to").value = "";
    document.querySelector("#filter-status").value = "";
    const { products, users, orders } = await fetchData();
    renderOrderTable(products, users, orders);
  });

// Print button
document.querySelector("#print-orders-btn").addEventListener("click", () => {
  window.print();
});

// Function that creates a product
async function createProduct() {
  const name = document.querySelector("#name");
  const description = document.querySelector("#description");
  const price = document.querySelector("#price");
  const imageURL = document.querySelector("#image");
  const releaseDate = document.querySelector("#release-date");

  let emptyFields = [];
  let otherErrors = [];

  if (!name.value.trim()) {
    emptyFields.push("Name");
    name.style.border = "1px solid red";
  }
  if (!description.value.trim()) {
    emptyFields.push("Description");
    description.style.border = "1px solid red";
  }
  if (!price.value) {
    emptyFields.push("Price");
    price.style.border = "1px solid red";
  }
  if (!imageURL.value.trim()) {
    emptyFields.push("Image URL");
    imageURL.style.border = "1px solid red";
  }
  if (!releaseDate.value) {
    emptyFields.push("Release Date & Time");
    releaseDate.style.border = "1px solid red";
  }

  if (price.value && Number(price.value) < 0) {
    otherErrors.push("Price must be positive");
    price.style.border = "1px solid red";
  }

  let messages = [];
  if (emptyFields.length > 0) {
    messages.push(
      `${emptyFields.join(" & ")} ${emptyFields.length === 1 ? "field is" : "fields are"} empty`,
    );
  }
  messages = messages.concat(otherErrors);

  if (messages.length > 0) {
    const errorMsg = document.querySelector(".product-error-message");
    errorMsg.classList.add("product-error-msg");
    errorMsg.innerText = messages.join(" & ");
    return;
  }

  const product = {
    name: name.value,
    description: description.value,
    price: Number(price.value),
    image: imageURL.value,
    dropDate: new Date(releaseDate.value).toISOString(),
    status: "upcoming",
  };

  await addProduct(product);
  alert("Product created! Please add at least one size & stock.");

  await onPageLoad();
  document.querySelector(".create-product-form").reset();
}

//button event listener for create product
const createProductBtn = document.querySelector("#create-product-btn");

function cancelEdit() {
  editingProductId = null;

  document.querySelector(".create-product-form").reset();

  document.querySelector(".create-product h2").innerText = "Create Product";
  document.querySelector("#create-product-btn").innerText = "Create Product";

  cancelEditBtn.style.display = "none";
}

// Edit product button
const editBtn = document.querySelector("#edit-product-btn");

editBtn.addEventListener("click", async () => {
  const formTitle = document.querySelector(".create-product h2");

  const productSelect = document.querySelector("#choose-product");

  editingProductId = productSelect.value;

  const product = await getProduct(editingProductId);

  document.querySelector("#name").value = product.name;
  document.querySelector("#description").value = product.description;
  document.querySelector("#price").value = product.price;
  document.querySelector("#image").value = product.image;
  cancelEditBtn.style.display = "inline-block";

  const date = new Date(product.dropDate);
  document.querySelector("#release-date").value = date
    .toISOString()
    .slice(0, 16);

  formTitle.innerText = "Edit Product";
  document.querySelector("#create-product-btn").innerText = "Update Product";
});

//edit product function
async function editProduct() {
  const name = document.querySelector("#name");
  const description = document.querySelector("#description");
  const price = document.querySelector("#price");
  const imageURL = document.querySelector("#image");
  const releaseDate = document.querySelector("#release-date");

  if (!editingProductId) return;

  const products = await getProducts();
  const existingProduct = products.find((p) => p._id === editingProductId);
  if (!existingProduct) return;

  if (!name.value.trim() || !price.value) {
    const errorMsg = document.querySelector(".product-error-message");
    errorMsg.innerText = "Name and Price are required";
    return;
  }

  const product = {
    ...existingProduct,
    name: name.value,
    description: description.value,
    price: Number(price.value),
    image: imageURL.value,
    dropDate: new Date(releaseDate.value).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await updateProduct(editingProductId, product);

  editingProductId = null;

  document.querySelector(".create-product h2").innerText = "Create Product";
  document.querySelector("#create-product-btn").innerText = "Create Product";

  await onPageLoad();
  document.querySelector(".create-product-form").reset();
}

async function handleProductSubmit() {
  if (editingProductId) {
    await editProduct();
  } else {
    await createProduct();
  }
}

createProductBtn.addEventListener("click", () => {
  handleProductSubmit();
});

//Render all products so admin can choose which product to add variants to
function renderProductSelect(products) {
  const productSelect = document.querySelector("#choose-product");
  productSelect.innerHTML = "";

  products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product._id;
    option.innerText = product.name;
    productSelect.append(option);
  });
}

//Function to create variant
async function createVariant() {
  const size = document.querySelector("#size");
  const stock = document.querySelector("#stock");
  const productSelect = document.querySelector("#choose-product");

  const variants = await getVariants();

  let emptyFields = [];
  let otherErrors = [];

  if (!size.value) {
    emptyFields.push("Size");
    size.style.border = "1px solid red";
  }
  if (!stock.value) {
    emptyFields.push("Stock");
    stock.style.border = "1px solid red";
  }

  if (size.value && Number(size.value) < 0) {
    otherErrors.push("Size must be positive");
    size.style.border = "1px solid red";
  }
  if (stock.value && Number(stock.value) < 0) {
    otherErrors.push("Stock must be positive");
    stock.style.border = "1px solid red";
  }
  if (Number(stock.value) === 0) {
    otherErrors.push("Stock cannot be 0");
    stock.style.border = "1px solid red";
  }

  const sizeExists = variants.some(
    (v) =>
      v.productId === productSelect.value &&
      Number(v.size) === Number(size.value),
  );

  if (sizeExists) {
    otherErrors.push("This size already exists for the selected product");
    size.style.border = "1px solid red";
  }

  let messages = [];
  if (emptyFields.length > 0) {
    messages.push(
      `${emptyFields.join(" & ")} ${emptyFields.length === 1 ? "field is" : "fields are"} empty`,
    );
  }
  messages = messages.concat(otherErrors);

  if (messages.length > 0) {
    const errorMsg = document.querySelector(".variant-error-message");
    errorMsg.classList.add("product-error-msg");
    errorMsg.innerText = messages.join(" & ");
    return;
  }

  const variant = {
    productId: productSelect.value,
    size: size.value,
    stock: stock.value,
  };

  await addVariant(variant);
  await onPageLoad();
}

//Create Variant button listener
const addVariantBtn = document.querySelector("#create-variant-btn");

addVariantBtn.addEventListener("click", () => {
  createVariant();
});

//Function to delete product
async function removeProduct() {
  const productSelect = document.querySelector("#choose-product");
  const productId = productSelect.value;
  const productName = productSelect.options[productSelect.selectedIndex].text;

  //Guard for delete button
  const confirmed = window.confirm(
    `Are you sure you want to delete "${productName}"?`,
  );
  if (!confirmed) return;

  const result = await deleteProduct(productId);

  if (result) {
    const selectedOption = productSelect.querySelector(
      `option[value="${productId}"]`,
    );
    selectedOption.remove();
  }
}

const deleteProductBtn = document.querySelector("#delete-product-btn");
deleteProductBtn.addEventListener("click", removeProduct);

//For tabs rendering
const tabButtons = document.querySelectorAll(".tabs button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabContents.forEach((tab) => tab.classList.remove("active"));

    const targetTab = document.getElementById(btn.dataset.tab);
    targetTab.classList.add("active");

    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
