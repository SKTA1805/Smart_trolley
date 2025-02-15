const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Serve static files

let cart = [];
const productList = {
    "4D00A7B52F70": { name: "Dark Fantasy", price: 50.0 },
    "4D00A6F2554C": { name: "Bread Board", price: 50.0 },
    "4D00A6F2253C": { name: "Product3", price: 20.0 },
    "4D00A7B594CB": { name: "Product4", price: 30.0 },
};

// WebSocket Broadcast Function
function broadcastCartUpdate() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send("update_cart");
        }
    });
}

// **Serve the main HTML file**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// **Add item to cart when scanned**
app.post("/update-cart", (req, res) => {
    const { tag } = req.body;
    if (!productList[tag]) {
        return res.status(400).json({ success: false, message: "Invalid RFID Tag" });
    }
    const product = cart.find(item => item.tag === tag);
    if (product) {
        product.quantity += 1;
    } else {
        cart.push({ tag, name: productList[tag].name, price: productList[tag].price, quantity: 1 });
    }

    broadcastCartUpdate(); // Notify WebSocket clients
    res.json({ success: true, message: "Cart updated", cart });
});

// **Get cart items**
app.get("/cart", (req, res) => {
    res.json(cart);
});

// **Remove item from cart**
// **Decrease quantity instead of removing the item completely**
app.post("/remove-item", (req, res) => {
  const { tag } = req.body;
  const productIndex = cart.findIndex(item => item.tag === tag);

  if (productIndex !== -1) {
      if (cart[productIndex].quantity > 1) {
          cart[productIndex].quantity -= 1; // Decrease quantity by 1
      } else {
          cart.splice(productIndex, 1); // If only 1 left, remove from cart
      }
  }

  res.json({ success: true, message: "Item updated", cart });
});


// **Generate PDF Bill**
app.get("/generate-bill", (req, res) => {
    const doc = new jsPDF();
    let totalQuantity = 0;
    let total = 0;

        // Load a stylish font (Make sure to include the font file in your project)
    doc.addFont("GreatVibes-Regular.ttf", "GreatVibes", "normal");
    doc.setFont("GreatVibes"); // Use the stylish font
    doc.setFontSize(22);

    // Reset font to normal for table and details
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);

    if (cart.length === 0) {
        doc.text("Your cart is empty", 20, 20);
    } else {
        const tableData = cart.map(item => {
            const subtotal = item.quantity * item.price;
            totalQuantity += item.quantity;
            total += subtotal;
            return [item.name, `${item.price} Rs`, item.quantity, `${subtotal} Rs`];
        });
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        const pageWidth = doc.internal.pageSize.getWidth(); // Get the page width
        const text = "Your Bill";
        const textWidth = doc.getTextWidth(text); // Get the width of the text
        const centerX = (pageWidth - textWidth) / 2; // Calculate the center position
        doc.text(text, centerX, 20);
        
        doc.autoTable({
            head: [['Product', 'Price', 'Quantity', 'Subtotal']],
            body: tableData,
            startY: 30,
        });
        // Position for the total and thank you message
        let finalY = doc.lastAutoTable.finalY + 10;
        doc.text(`Total Qty: ${totalQuantity}`, 20, finalY);
        doc.text(`Total Amt: ${total}.00 Rs`, 20, finalY + 10);

        // Add "Thank you for visiting us!" centered at the bottom
         // Add "Thank you for visiting us!" in a stylish font
        doc.setFont("GreatVibes");
        doc.setFontSize(18);
        const thankYouText = "Thank you for visiting us!";
        const thankYouTextWidth = doc.getTextWidth(thankYouText);
        const thankYouX = (pageWidth - thankYouTextWidth) / 2;
        doc.text(thankYouText, thankYouX, finalY + 30);
        }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bill.pdf"');
    res.send(Buffer.from(doc.output('arraybuffer')));
});

require("dotenv").config();
const Razorpay = require("razorpay");
const crypto = require("crypto");



// **Create Order API (Frontend calls this to start payment)**
app.post("/create-order", async (req, res) => {
    try {
        const { amount } = req.body; // Amount in INR
        const options = {
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, orderId: order.id, amount: order.amount });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// **Verify Payment API (Razorpay webhook or frontend calls this after payment)**
app.post("/verify-payment", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generated_signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    if (generated_signature === razorpay_signature) {
        console.log("Payment Verified Successfully");
        res.json({ success: true, message: "Payment Successful!", paymentId: razorpay_payment_id });
    } else {
        res.status(400).json({ success: false, message: "Payment Verification Failed" });
    }
});

// Start the server with WebSocket
server.listen(PORT, () => console.log(`Server running on httlocalhostp://:${PORT}`));
