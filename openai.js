const OpenAI = require('openai');
require("dotenv").config();

let API_AI_URL;
let API_AI_API_KEY;
let OPENAI_MODEL;

if (false) {
    API_AI_URL = process.env.DEEPSEEK_URL;
    API_AI_API_KEY = process.env.DEEPSEEK_API_KEY;
    OPENAI_MODEL = process.env.DEEPSEEK_MODEL;
} else {
    API_AI_URL = process.env.OPENAI_URL;
    API_AI_API_KEY = process.env.OPENAI_API_KEY;
    OPENAI_MODEL = process.env.OPENAI_MODEL;
}

const openai = new OpenAI({
    apiKey: API_AI_API_KEY, // Substitua pela sua chave de API da DeepSeek
    baseURL: API_AI_URL,
});

module.exports = openai;
