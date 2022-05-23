const {MongoClient} = require('mongodb');
var express = require('express');
var app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const res = require('express/lib/response');
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
  } catch (e) {
    console.error(e);
  }
}
connectToDB().catch(console.error);

async function getUser(user_name) {
  const users = client.db("Integration_DB").collection("Users");
  return await users.find({username : user_name}).toArray();
}


app.use(express.static(path.join(__dirname,'/public')))

app.get('/', async function(req, res) {
  try {
    res.sendFile(path.join(__dirname, '/public/index.html'));
  } catch (e) {
    console.error(e);
    res.send("Error: " + e);
  }
})


app.get('/authenticate/:token', async (req, res) => {
  // if(!authorized(req.params["Eleos-Platform-Key"])){ res.status(401).end(); }
  try{
    // let decoded = jwt.decode(req.params.token);
    // let users = Object.values(decoded);
    // let user = await users.find({username : "NOHAM"}).toArray();

    let user = getUser("NOHAM");
    console.log(user);
  
    const response = { 
      full_name : user.full_name,
      api_token : 1234,
      menu_code : user.menu_code,
      dashboard_code : user.dashboard_code,
      custom_settings_form_code : user.custom_settings_form_code,
      username : user.username 
    }
    console.log(response)
    res.send(response)
  } catch(e) {
    console.error(e);
    res.send("Error: " + e);
  }
})

app.get('/loads', async (req, res) => {
  
})

app.put('/messages/:handle', async (req, res) => {
  
})


app.listen(process.env.PORT || 3000, 
  () => console.log("The server is running!!!"));