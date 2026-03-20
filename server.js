const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());
app.use(cors());

// 🔥 TESTE ONLINE
app.get("/", (req,res)=>{
  res.send("online");
});

// 🔥 FIREBASE
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://ferramentas-projeto.firebaseio.com/"
});

// 🔥 MERCADO PAGO
mercadopago.configure({
  access_token: process.env.MP_TOKEN
});

// 💰 GERAR PIX
app.post("/pix", async (req,res)=>{
  try{
    const { user, valor } = req.body;

    let valorFinal = parseFloat(String(valor).replace(",", "."));

    if(!valorFinal || valorFinal <= 0){
      return res.status(400).json({erro:"Valor inválido"});
    }

    console.log("💰 GERANDO PIX:", user, valorFinal);

    const pagamento = await mercadopago.payment.create({
      transaction_amount: valorFinal,
      description: "Adicionar saldo",
      payment_method_id: "pix",

      payer: {
        email: "teste@test.com"
      },

      // 🔥 ESSA LINHA É O SEGREDO
      notification_url: "https://server-3-tkgb.onrender.com/webhook",

      metadata: {
        user: user
      }
    });

    res.json({
      qr: pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
      copia: pagamento.body.point_of_interaction.transaction_data.qr_code
    });

  }catch(e){
    console.log("❌ ERRO PIX:", e);
    res.sendStatus(500);
  }
});

// 🔥 WEBHOOK (RECEBE PAGAMENTO)
app.post("/webhook", async (req,res)=>{
  try{

    console.log("🔥 WEBHOOK RECEBIDO:", JSON.stringify(req.body));

    const paymentId = req.body?.data?.id || req.body?.id;

    if(!paymentId){
      return res.sendStatus(200);
    }

    const pagamento = await mercadopago.payment.findById(paymentId);

    console.log("📊 STATUS:", pagamento.body.status);

    if(pagamento.body.status === "approved"){

      const user = pagamento.body.metadata?.user;
      const valor = pagamento.body.transaction_amount;

      if(!user){
        console.log("❌ usuário não encontrado");
        return res.sendStatus(200);
      }

      // 💰 ADICIONA SALDO
      await admin.database().ref("ganhos/"+user).transaction(s=>{
        return (s || 0) + valor;
      });

      // 📊 HISTÓRICO
      await admin.database().ref("historico/"+user).push({
        tipo:"entrada",
        valor:valor,
        data:Date.now()
      });

      console.log("✅ SALDO ADICIONADO:", user, valor);
    }

    res.sendStatus(200);

  }catch(e){
    console.log("❌ ERRO WEBHOOK:", e);
    res.sendStatus(200);
  }
});

// 🚀 START
app.listen(10000, ()=>{
  console.log("🔥 Servidor rodando");
});
