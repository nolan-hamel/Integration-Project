const {MongoClient} = require('mongodb');
var express = require('express');
var app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const { get } = require('express/lib/response');
const res = require('express/lib/response');
const dotenv = require('dotenv').config();

const urlParser = express.urlencoded();

function authorized(key) {
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

async function getUser(username) {
  const users = client.db("Integration_DB").collection("Users");
  let user = await users.find({username : username}).toArray();
  if(user[0] == undefined) return -1;
  return user[0];
}

async function getLoads(username) {
  const loads = client.db("Integration_DB").collection("Loads");
  let usersLoads = await loads.find({users: username}).toArray();
  usersLoads.forEach(u => delete u._id);
  usersLoads.forEach(u => delete u.users);
  return usersLoads;
}

app.get('/', function (req, res) {
  try {
    res.sendFile(path.join(__dirname, '/public/index.html'));
  } catch (e) {
    console.error(e);
    res.send("Error: " + e);
  }
})

app.get('/authenticate/:token', async (req, res) => {
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(400).send("400 Bad request");
    return;
  }
  try{
    await connectToDB().catch(console.error);
    try{
      var decoded = jwt.decode(req.params.token);
    } catch(e) {
      res.status(400).send("400 Bad request");
      client.close();
      return;
    }
    var username = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    var user = await getUser(username);
    if(user == -1) {
      var username = decoded.username;
      var user = await getUser(username);
    }
    if(user == -1) {
      res.status(401).send("401 Unauthorized due to invalid username or password.");
      client.close();
      return;
    }

    let encoded = jwt.sign({full_name : user.full_name, username : user.username}, process.env.SECRET_KEY);
    const response = {
      full_name : user.full_name,
      username : user.username,
      api_token : encoded,
      menu_code : user.menu_code,
      dashboard_code : user.dashboard_code,
      custom_settings_form_code : user.custom_settings_form_code
    }
    console.log(response);
    res.send(response);
    client.close();
  } catch(e) {
    console.error(e);
    res.send("Error: " + e);
  }
})

app.get('/loads', async (req, res) => {
  if(!authorized(req.get("Eleos-Platform-Key")))
  {
    res.status(400).send("400 Bad request");
    return;
  }
  try {
    await connectToDB().catch(console.error);
    // if not authorized res.send('401');
    let response = await getLoads("NOHAM");
    console.log(response);
    res.send(response);
    client.close();
  } catch(e) {
    console.error(e);
    res.send("Error: " + e);
  }
})

app.put('/messages/:handle', urlParser, async (req, res) => {
  if(authorized(req.get("Eleos-Platform-Key")))
  {
    let response = [{
      description : "401 Unauthorized due to missing or invalid token and/or API key.",
      code: "401"
    }]
    res.status(401).send(response);
    return;
  }
  try {
    await connectToDB().catch(console.error);
    let handle = req.params.handle;
    let body = req.body;
    let messages = client.db("Integration_DB").collection("Messages");
    console.log(body);
    messages.insertOne({
      handle: handle,
      direction: body.direction,
      username: body.username,
      message_type: body.message_type,
      body: body.body,
      composed_at: body.composed_at,
      platform_received_at: body.platform_received_at
    })
    
    res.send({handle : handle});
  } catch(e) {
    console.error(e);
    res.status(401).send("Error: " + e);
  }
})


app.listen(process.env.PORT || 3000, 
  () => console.log("The server is running!!!"));