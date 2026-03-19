const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const admin = require("firebase-admin");
console.log("🔥 SERVIDOR ATIVO 🔥");
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
const { user, valor } = req.body;
console.log("VALOR RECEBIDO:", valor);
// 🔥 CORREÇÃO DO VALOR
let valorFinal = String(valor).replace(",", ".");
valorFinal = parseFloat(valorFinal);

if(!valorFinal || valorFinal <= 0){
return res.status(400).json({erro:"Valor inválido"});
}

// 💰 CRIA PIX
const pagamento = await mercadopago.payment.create({
transaction_amount: valorFinal,
description: "Adicionar saldo",
payment_method_id: "pix",
payer:{email:"diel_zi_nho25@hotmail.com"},
metadata:{user:user}
});

res.json({
qr: pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
copia: pagamento.body.point_of_interaction.transaction_data.qr_code
});
});

// 🔥 WEBHOOK PROFISSIONAL
app.post("/webhook", async (req,res)=>{

const paymentId = req.body.data.id;

const pagamento = await mercadopago.payment.findById(paymentId);

if(pagamento.body.status==="approved"){

const user = pagamento.body.metadata.user;
const valor = pagamento.body.transaction_amount;

// 💸 TAXA (você ganha 20%)
const usuarioRecebe = valor * 0.8;
const seuLucro = valor * 0.2;

// SALDO USUÁRIO
admin.database().ref("ganhos/"+user).transaction(g=>(g||0)+usuarioRecebe);

// HISTÓRICO
admin.database().ref("historico/"+user).push({
tipo:"entrada",
valor:usuarioRecebe,
data:Date.now()
});

// 👥 AFILIADO
const snap = await admin.database().ref("usuarios/"+user).once("value");
const ref = snap.val()?.ref;

if(ref){
admin.database().ref("ganhos/"+ref).transaction(g=>(g||0)+(valor*0.1));
}

}

res.sendStatus(200);
});
