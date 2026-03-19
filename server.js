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
app.post("/pix", async (req,res)=>{

const {valor,user} = req.body;

const pagamento = await mercadopago.payment.create({
transaction_amount: Number(valor),
description: "Adicionar saldo",
payment_method_id: "pix",
payer:{email:"teste@test.com"},

metadata:{
user: user
}

});

res.json({
qr: pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
copia: pagamento.body.point_of_interaction.transaction_data.qr_code
});

});

// 🔥 WEBHOOK PROFISSIONAL
app.post("/webhook", async (req,res)=>{

try{

console.log("🔥 WEBHOOK RECEBIDO:", JSON.stringify(req.body));

const paymentId = req.body?.data?.id;

if(!paymentId){
return res.sendStatus(200);
}

const pagamento = await mercadopago.payment.findById(paymentId);

if(pagamento.body.status === "approved"){

const user = pagamento.body.metadata?.user;
const valor = pagamento.body.transaction_amount;

if(!user){
console.log("❌ usuário não encontrado");
return res.sendStatus(200);
}

// adiciona saldo
await admin.database().ref("ganhos/"+user).transaction(s=>{
return (s || 0) + valor;
});

// histórico
await admin.database().ref("historico/"+user).push({
tipo:"entrada",
valor:valor,
data:Date.now()
});

console.log("✅ PAGAMENTO APROVADO:", user, valor);

}

res.sendStatus(200);

}catch(e){
console.log("❌ ERRO WEBHOOK:", e);
res.sendStatus(200); // nunca retorna erro pro MP
}

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
