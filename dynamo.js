const AWS = require("aws-sdk");

// Configuração para usar o DynamoDB Local
const dynamoDB = new AWS.DynamoDB.DocumentClient({
    region: "us-east-1",
    endpoint: "http://localhost:8000" // Conectar ao banco local
});

// Criar um item na tabela
async function createUser(data) {
    var response={isSucess:false}
    const params = {
        TableName: "history_message",
        Item: data
    };

    try {
        await dynamoDB.put(params).promise();
        console.log("Usuário criado com sucesso!", data);
        response.isSucess=true;
        return response;
    } catch (error) {
        console.error("Erro ao inserir usuário:", error);
        return response;
    }
};

async function getItemByKey(tableName, keyValue) {
    const params = {
      TableName: tableName,
      Key: {
        ['userId']: keyValue, // Define dinamicamente a chave
      },
    };
  
    try {
      const data = await dynamoDB.get(params).promise();
      if (!data.Item) {
        console.log(`Item com ${keyName} = ${keyValue} não encontrado.`);
        return null;
      }
      console.log("Item encontrado:", data.Item);
      return data.Item;
    } catch (error) {
      console.error("Erro ao buscar item:", error);
      throw error;
    }
  }

module.exports = {createUser,getItemByKey};