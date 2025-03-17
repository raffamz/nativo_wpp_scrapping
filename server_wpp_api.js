const express = require("express");
const bodyParser = require("body-parser");
const axios = require('axios');
const openai = require('./openai');
const { createUser,getItemByKey } = require('./dynamo');
require("dotenv").config();

const app = express();
const PORT = 5900;

// Middleware para interpretar JSON
app.use(bodyParser.json());

// Token de verificação (defina o mesmo no Meta Developers)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL;
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const LLM_URL = process.env.LLM_URL

// Objeto para armazenar o histórico de conversas
const conversationHistory = {};

// Endpoint para validação do webhook do WhatsApp
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
        console.log("Webhook verificado com sucesso!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});
var i = 0;
// Endpoint para receber mensagens do WhatsApp
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        res.sendStatus(200);
        // var from;
        //var text;
        console.log(":::::::WEBHOOKS ACIONADO::::::::", i++);
        console.log("CONVERSATIONHISTORY::::: ", conversationHistory);
        console.log(":::::::body.object::::::::", body.object);
        if (body.object === "whatsapp_business_account") {
            for (const entry of body.entry) {
                // console.log(`Entry [${body.entry.length}]`);
                for (const change of entry.changes) {
                    //   console.log(`Changes [${entry.changes.length}]`);
                    if (change.value && change.value.messages) {
                        //   console.log(`Messages [${change.value.messages.length}]`);
                        const message = change.value.messages[0];
                        const contact = change.value.contacts[0];
                        const from = message.from; // Número do cliente
                        const text = message.text ? message.text.body : "Mensagem sem texto"; // Mensagem do cliente

                        console.log("######################");
                        console.log("Mensagem recebida:");
                        console.log(contact.profile.name); // Nome do cliente
                        console.log(contact.wa_id); // Telefone do cliente
                        console.log(message.from); // Número do cliente
                        console.log(message.type); // Tipo da mensagem
                        console.log(message.id); // WAMID
                        console.log(`Mensagem recebida de ${from}: ${text}`);
                        console.log("######################");

                        // Aguarda o processamento da mensagem antes de continuar
                        var response = "Recebi sua mensagem.";

                        response = await processMessage(text, contact.wa_id);

                        // Envia a resposta para o cliente no WhatsApp
                        await sendReply(from, response);

                        // Responde com sucesso para evitar que o WhatsApp tente reenviar a notificação
                        return res.status(200);
                    }
                }
            }
        } else {
            console.error("conflit");
            return res.status(500).json({ error: "Erro no servidor" });
        }

    } catch (error) {
        console.error("Erro no processamento do webhook:", error);
        res.sendStatus(500); // Responde com erro interno do servidor
    }
});


// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});


async function processMessage(text, userId) {
    // Inicializa o histórico do usuário, se não existir
    // Inicializa o histórico do usuário, se não existir
    let getItem=getItemByKey('history_message', userId);
    conversationHistory[userId]=getItem.conversationHistory;
    console.log("!conversationHistory[userId]::::: ", !conversationHistory[userId]);
    if (!getItem.userId) {
        conversationHistory[userId] = [];
    }

    // Adiciona a mensagem do usuário ao histórico
    conversationHistory[userId].push({ role: "user", content: text });

    // Limita o histórico para as últimas 10 interações
    if (conversationHistory[userId].length > 10) {
        conversationHistory[userId].shift();
    }
    console.log("CONVERSATIONHISTORY::::: ", conversationHistory[userId]);
   
    // Início da medição do tempo
    const startTime = Date.now();
    try {
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL, // DEEPSEEK_MODEL  Especifica o modelo econômico
            messages: [
                { role: 'system', content: 'Vc é um interpretador de mensagens que irei enviar para vc. AS mensagens são relacionadas aos gastos e recebimentos que a pessoa vai ter. Utilizaremos isso para organização financeira. Inclusive dando dicas para melhorar o gasto ou não. Vc deve formatar sua resposta sempre em um objeto JSON, e somente isso. Sem nenhum texto fora do objeto json. O Json terá 3 atributos. São eles: messageReceived, messageResponse, item, value, category, appellant e done messageReceived é a mensagem enviada para vc. messageResponse é a mensagem que vc responderia. item é o produto que vc deverá identificar na mensagem quando houver. value é o valor do produto que vc identificar na mensagem. category é tipo de categoria do gasto appellant é se o gasto é recorrente ou não. done é quanto vc identifica todos os atributos (com exceção de appellant se ele vier nulo, pode desconsiderar), o valor dele é booleano. True para quando identificou todos (com exceção de appellant ), e false para quando não.' },
                ...conversationHistory[userId]
            ],
            temperature: 0.3,
            max_tokens: 200
        });
        // Fim da medição do tempo
        const endTime = Date.now();
        const elapsedTime = endTime - startTime; // Tempo em milissegundo

        console.log("Resposta IA:: ", response.choices[0].message.content);
        let reply = response.choices[0].message.content;

        // Remove qualquer <think>...</think> antes de responder
        reply = reply.replace(/```json|```/g, "").trim();
        reply = JSON.parse(reply);

        console.log(`Resposta messageResponse: ${reply.messageResponse}`);
        console.log(`Resposta gerada: ${reply}`);
        conversationHistory[userId].push({ role: "system", content: reply.messageResponse });
        var data = { userId }
        data.conversationHistory = conversationHistory[userId]
        await createUser(data);
        console.log(`⏳ Tempo de resposta: ${elapsedTime} ms`);
        return reply.messageResponse;
    } catch (error) {
        console.error('Erro:', error);
    }

}


// Função para enviar resposta automática
const sendReply = async (to, text) => {
    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`;
    const headers = {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
    };
    const data = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
    };

    try {
        await axios.post(url, data, { headers });
        console.log("Mensagem respondida.");
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error.response ? error.response.data : error);
    }
};