const {MongoClient} = require('mongodb');
var express = require('express');
var app = express();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();

function authorized(key) {
  console.log(process.env.ELEOS_PLATFORM_KEY)
  console.log(key);
  if(key === process.env.ELEOS_PLATFORM_KEY) return true;
  return false;
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@nolans-eleos-db.hlgtg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);
async function connectToDB() {
  try {
    await client.connect();
    const users = client.db("Integration_DB").collection("Users");
    let user = await users.find({username : "NOHAM"}).toArray();
    console.log(user);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
connectToDB().catch(console.error);




app.get('/authenticate/:token', (req, res) => {
  if(!authorized(req.params["Eleos-Platform-Key"])){ res.status(401).end(); }
  let decoded = jwt.decode(req.params.token);
  let users = Object.values(decoded);
  let user = client.db("Integration_DB").collection("Users").find({username : "NOHAM"});
  
  res.status(200).send({
    full_name: user.full_name
  });
})

app.get('/loads', (req, res) => {
  
})

app.put('/messages/:handle', (req, res) => {
  
})


app.listen(3000, 
  () => console.log("The server is running!!!"));