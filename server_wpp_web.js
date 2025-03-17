const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const openai = require('./openai');

const { init } = require('./scraping');
require("dotenv").config();



const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL;
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const LLM_URL = process.env.LLM_URL
const PROFILE_AGENT = process.env.PROFILE_AGENT;

// Objeto para armazenar o histórico de conversas
const conversationHistory = {};


// Inicializa o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth() // Salva a sessão localmente
});

// Gera o QR Code no terminal
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Quando estiver pronto, exibe uma mensagem
client.on('ready', () => {
    console.log('Client is ready!');
});

// Escuta mensagens recebidas
client.on('message', async (message) => {
    console.log(`⁠Mensagem recebida de ${message.from}: ${message.body}`);

    // Processa a mensagem com LM Studio usando o histórico
    const response = await processMessage(message.body, message.from);

    // Responde a mensagem no WhatsApp
    message.reply(response);
});

// Inicializa o cliente
client.initialize();



async function processMessage(text, userId) {
    // Inicializa o histórico do usuário, se não existir
    // Inicializa o histórico do usuário, se não existir
    // let getItem=getItemByKey('history_message', userId);
    // conversationHistory[userId]=getItem.conversationHistory;
    //console.log("!conversationHistory[userId]::::: ", !conversationHistory[userId]);
    //if (!getItem.userId) {
    //    conversationHistory[userId] = [];
    //}

    // Adiciona a mensagem do usuário ao histórico
    //conversationHistory[userId].push({ role: "user", content: text });
    if (!conversationHistory[userId]) {
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
                { role: 'system', content: PROFILE_AGENT },
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
        reply = reply.match(/{.*}/s);
        console.log("Resposta JSON tratado1 :: ", reply);
        reply = JSON.parse(reply);

        console.log("Resposta JSON tratado2 :: ", reply);

        conversationHistory[userId].push({ role: "system", content: reply.messageResponse });
        var data = { userId }
        data.conversationHistory = conversationHistory[userId]
        //  await createUser(data);
        // Adiciona a resposta da IA ao histórico
        conversationHistory[userId].push({ role: "assistant", content: reply.messageResponse });
        console.log(`Resposta gerada para ${userId}: ${reply}`);
        console.log(`DONE: ${reply.requests.done}`);
        if (reply.requests.done) {
            reply.response = {};
            reply.response.message = await init(reply.requests);
            reply.response.service = reply.requests.service;
            reply.messageResponse = `Dados retornados: ${reply.response.message} para o serviço ${reply.response.service}`;
        }

        console.log(`⏳ Tempo de resposta: ${elapsedTime} ms`);
        return reply.messageResponse;
    } catch (error) {
        console.error('Erro:', error);
    }

}