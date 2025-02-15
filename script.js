// Function to toggle between welcome screen and billing section
document.getElementById("add-to-cart-btn").addEventListener("click", function () {
    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("billing-section").style.display = "block";
});

// Function to go back to the welcome screen
function goBackToWelcome() {
    document.getElementById("billing-section").style.display = "none";
    document.getElementById("welcome-screen").style.display = "block";
}

// Existing WebSocket functionality
const socket = new WebSocket("ws://https://smart-trolley-vg35.onrender.com"); // Connect WebSocket to the server

socket.onmessage = (event) => {
    if (event.data === "update_cart") {
        fetchCart(); // Fetch updated cart data when notified
    }
};

// Fetch cart data and update the UI dynamically
async function fetchCart() {
    try {
        const response = await fetch("https://smart-trolley-vg35.onrender.com/cart"); // Replace with your server IP
        const cart = await response.json();

        let cartHTML = "";
        let totalQuantity = 0;
        let totalAmount = 0;

        cart.forEach(item => {
            let subtotal = item.quantity * item.price;
            totalQuantity += item.quantity;
            totalAmount += subtotal;

            cartHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.price.toFixed(2)} ₹</td>
                    <td>${item.quantity}</td>
                    <td>${subtotal.toFixed(2)} ₹</td>
                    <td><button class="remove-btn" onclick="removeItem('${item.tag}')">Remove</button></td>
                </tr>
            `;
        });

        document.getElementById("cart-items").innerHTML = cartHTML;
        document.getElementById("total-quantity").textContent = totalQuantity;
        document.getElementById("total-amount").textContent = totalAmount.toFixed(2) + " ₹";
    } catch (error) {
        console.error("Error fetching cart:", error);
    }
}

// Remove item from cart
async function removeItem(tag) {
    try {
        const response = await fetch(`https://smart-trolley-vg35.onrender.com/remove-item`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tag })
        });

        const result = await response.json();
        if (result.success) {
            fetchCart(); // Re-fetch cart data to update UI
        }
    } catch (error) {
        console.error("Error removing item:", error);
    }
}

// Generate PDF Bill
async function generateBill() {
    try {
        const response = await fetch("https://smart-trolley-vg35.onrender.com/generate-bill");
        const blob = await response.blob();

        // Trigger the download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "bill.pdf";
        link.click();
    } catch (error) {
        console.error("Error generating bill:", error);
    }
}
document.getElementById("pay-now").addEventListener("click", function () {
    fetch("https://smart-trolley-vg35.onrender.com/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totalAmount }), // Total bill amount
    })
    .then(response => response.json())
    .then(order => {
        var options = {
            "key": "YOUR_RAZORPAY_KEY_ID",
            "amount": order.amount,
            "currency": "INR",
            "name": "Smart Trolley Billing",
            "order_id": order.orderId,
            "handler": function (response) {
                fetch("https://smart-trolley-vg35.onrender.com/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(response),
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert("Payment Successful!");
                        window.location.href = "/success-page";
                    } else {
                        alert("Payment Failed!");
                    }
                });
            },
            "theme": { "color": "#3399cc" }
        };
        var rzp = new Razorpay(options);
        rzp.open();
    })
    .catch(error => console.error("Payment Error:", error));
});

// Initial call to fetch the cart data when the page loads
fetchCart();
