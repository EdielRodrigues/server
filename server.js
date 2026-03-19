const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const admin = require("firebase-admin");

console.log("🔥 SERVIDOR ATIVO 🔥");

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req,res)=>{
res.send("online");
});

// 🔐 FIREBASE
admin.initializeApp({
credential: admin.credential.applicationDefault(),
databaseURL: "https://ferramentas-projeto.firebaseio.com/"
});

// 🔐 MERCADO PAGO
mercadopago.configure({
access_token: process.env.MP_TOKEN
});

// ==========================
// 💰 GERAR PIX
// ==========================
app.post("/pix", async (req,res)=>{

try{

const { user, valor } = req.body;

console.log("VALOR RECEBIDO:", valor);

// corrigir valor
let valorFinal = String(valor).replace(",", ".");
valorFinal = parseFloat(valorFinal);

if(!valorFinal || valorFinal <= 0){
return res.status(400).json({erro:"Valor inválido"});
}

// criar pagamento
const pagamento = await mercadopago.payment.create({
transaction_amount: valorFinal,
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

}catch(e){
console.log("❌ ERRO PIX:", e);
res.status(500).json({erro:"Erro ao gerar PIX"});
}

});

// ==========================
// 🔥 WEBHOOK
// ==========================
app.post("/webhook", async (req,res)=>{

try{

console.log("🔥 WEBHOOK:", JSON.stringify(req.body));

const paymentId = req.body?.data?.id || req.body?.id;

if(!paymentId){
console.log("❌ sem paymentId");
return res.sendStatus(200);
}

// 🔥 busca pagamento real
const pagamento = await mercadopago.payment.findById(paymentId);

console.log("💰 STATUS:", pagamento.body.status);

if(pagamento.body.status === "approved"){

const user = pagamento.body.metadata?.user;
const valor = pagamento.body.transaction_amount;

if(!user){
console.log("❌ usuário não encontrado");
return res.sendStatus(200);
}

// 💰 soma saldo
await admin.database().ref("ganhos/"+user).transaction(s=>{
return (s || 0) + valor;
});

// 📊 histórico
await admin.database().ref("historico/"+user).push({
tipo:"entrada",
valor:valor,
data:Date.now()
});

console.log("✅ SALDO ADICIONADO:", user, valor);

}

res.sendStatus(200);

}catch(e){
console.log("❌ ERRO:", e);
res.sendStatus(200);
}

});

// 👥 afiliado
const snap = await admin.database().ref("usuarios/"+user).once("value");
const ref = snap.val()?.ref;

if(ref){
await admin.database().ref("ganhos/"+ref).transaction(g=>(g||0)+(valor*0.1));
}

console.log("✅ PAGAMENTO APROVADO:", user, valor);

}

res.sendStatus(200);

}catch(e){
console.log("❌ ERRO WEBHOOK:", e);
res.sendStatus(200);
}

});

// ==========================
// 🚀 START SERVIDOR
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
console.log("🚀 Rodando na porta", PORT);
});
