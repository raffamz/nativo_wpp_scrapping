const puppeteer = require('puppeteer');

async function init() {
    const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium-browser', headless: true }); // Abre o navegador visível para depuração
    const page = await browser.newPage();

    await page.goto('https://transito.mg.gov.br/infracoes/multa/consultar-pontuacao-cnh'); // Substitua pela URL do site desejado

    // Preenchendo os campos do formulário
    await page.type('#cpf', '05575542769'); // Substitua pelo seletor correto do CPF
    await page.type('#datanascimento', '01/01/1984'); // Substitua pelo seletor correto da data de nascimento
    await page.type('#dataprimeirahabilitacao', '17/09/2002'); // Substitua pelo seletor correto da data de emissão

    const fullXPath = '/html/body/main/div/div[2]/div[1]/div/div/div[4]/div/form/button'; // Exemplo de Full XPath

    await page.evaluate((fullXPath) => {
        const button = document.evaluate(fullXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (button) button.click();
    }, fullXPath);
   

    // Aguarde um tempo para processar os resultados
    await new Promise(resolve=> setTimeout(resolve, 2000));

    // Capturando dados da página (exemplo de extração)
    const resultado = await page.evaluate(() => {
        return document.querySelector('#resultado')?.innerText || 'Nenhum resultado encontrado';
    });
    
    console.log('Resultado:', resultado);
    
    // Fechar o navegador
    await browser.close();
    return resultado;
};


module.exports = {init};
