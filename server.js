const express = require("express");
const mercadopago = require("mercadopago");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// 🔐 COLE SEU TOKEN AQUI
mercadopago.configure({
access_token: process.env.TOKEN
});

app.post("/pagar", async (req, res) => {
try {

const { nome, pix, valor } = req.body;

await mercadopago.payment.create({
transaction_amount: Number(valor),
description: "Pagamento App",
payment_method_id: "pix",
payer: {
email: "pagamento@app.com",
first_name: nome
}
});

res.json({ ok:true });

} catch (err) {
res.json({ ok:false, erro: err.message });
}
});

app.listen(10000, () => {
console.log("Servidor rodando");
});
