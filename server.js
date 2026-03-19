const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());
app.use(cors());

// 🔐 FIREBASE ADMIN
admin.initializeApp({
credential: admin.credential.applicationDefault(),
databaseURL: "https://ferramentas-projeto.firebaseio.com/"
});

// 🔐 MERCADO PAGO
mercadopago.configure({
access_token: process.env.MP_TOKEN
});

// 💰 GERAR PIX
app.post("/pix", async (req,res)=>{
const { user } = req.body;

const pagamento = await mercadopago.payment.create({
transaction_amount: 10,
description: "Adicionar saldo",
payment_method_id: "pix",
payer:{email:"teste@test.com"},
metadata:{user:user}
});

res.json({
qr: pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
copia: pagamento.body.point_of_interaction.transaction_data.qr_code
});
});

// 🔥 WEBHOOK (SALDO AUTOMÁTICO)
app.post("/webhook", async (req,res)=>{

try{

const paymentId = req.body.data.id;

const pagamento = await mercadopago.payment.findById(paymentId);

if(pagamento.body.status === "approved"){

const user = pagamento.body.metadata.user;
const valor = pagamento.body.transaction_amount;

// saldo
admin.database().ref("ganhos/"+user).transaction(g=>{
return (g||0) + valor;
});

// histórico
admin.database().ref("historico/"+user).push({
tipo:"entrada",
valor:valor,
data:Date.now()
});

}

res.sendStatus(200);

}catch(e){
res.sendStatus(500);
}

});

app.listen(10000, ()=>console.log("🔥 Servidor rodando"));
