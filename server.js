const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());
app.use(cors());

// 🔥 FIREBASE PRIMEIRO
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://ferramentas-projeto.firebaseio.com/"
});

// 🔥 DEPOIS AS ROTAS
app.get("/", (req,res)=>{
  res.send("online");
});

app.get("/teste-saldo", async (req,res)=>{

  await admin.database().ref("ganhos/teste123").set(50);

  res.send("SALDO TESTE OK");
});

// 🔥 MERCADO PAGO
mercadopago.configure({
  access_token: process.env.MP_TOKEN
});

// 💰 GERAR PIX + VERIFICAÇÃO AUTOMÁTICA
app.post("/pix", async (req,res)=>{
  try{

    const { user, valor } = req.body;

    let valorFinal = parseFloat(String(valor).replace(",", "."));

    if(!valorFinal || valorFinal <= 0){
      return res.status(400).json({erro:"Valor inválido"});
    }

    const pagamento = await mercadopago.payment.create({
      transaction_amount: valorFinal,
      description: "Adicionar saldo",
      payment_method_id: "pix",
      payer:{email:"teste@test.com"},
      metadata:{user:user}
    });

    const paymentId = pagamento.body.id;

    console.log("🆔 PAYMENT ID:", paymentId);

    // 🔥 LOOP DE VERIFICAÇÃO (GARANTE QUE VAI CAIR)
    let tentativas = 0;

    const verificar = setInterval(async () => {
      try{

        tentativas++;

        const p = await mercadopago.payment.findById(paymentId);

        console.log("📊 STATUS:", p.body.status);

        if(p.body.status === "approved"){

          const user = p.body.metadata?.user;
          const valor = p.body.transaction_amount;

          await admin.database().ref("ganhos/"+user).transaction(s=>{
            return (s || 0) + valor;
          });

          await admin.database().ref("historico/"+user).push({
            tipo:"entrada",
            valor:valor,
            data:Date.now()
          });

          console.log("✅ SALDO ADICIONADO DIRETO:", user, valor);

          clearInterval(verificar);
        }

        // 🔥 PARA DEPOIS DE 10 TENTATIVAS
        if(tentativas >= 10){
          console.log("⛔ PAROU DE VERIFICAR");
          clearInterval(verificar);
        }

      }catch(e){
        console.log("❌ ERRO VERIFICAÇÃO:", e);
      }

    }, 5000); // verifica a cada 5 segundos

    res.json({
      qr: pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
      copia: pagamento.body.point_of_interaction.transaction_data.qr_code
    });

  }catch(e){
    console.log("❌ ERRO PIX:", e);
    res.sendStatus(500);
  }
});

// 🚀 START
app.listen(10000, ()=>{
  console.log("🔥 Servidor rodando");
});
