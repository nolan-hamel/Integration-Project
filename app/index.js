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

async function getUser(username) {
  const users = client.db("Integration_DB").collection("Users");
  let user = await users.find({username : username}).toArray();
  return user[0];
}

async function getLoads(username) {
  const loads = client.db("Integration_DB").collection("Loads");
  let usersLoads = await loads.find({users: username}).toArray();
  usersLoads.forEach(u => delete u._id);
  usersLoads.forEach(u => delete u.users);
  return usersLoads;
}

app.use(express.static(path.join(__dirname,'/public')))

app.get('/', function (req, res) {
  try {
    res.sendFile(path.join(__dirname, '/public/index.html'));
  } catch (e) {
    console.error(e);
    res.send("Error: " + e);
  }
})

authorize = async(token) => {
  // decode token
  // let user =  await getUser("NOHAM");
  // if(user.username == decoded username) return true
  // return false
}


app.get('/authenticate/:token', async (req, res) => {
  try{
    await connectToDB().catch(console.error);
    // if not authorized res.send('401');

    // let decoded = jwt.decode(req.params.token);

    let user = await getUser("NOHAM");
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

app.put('/messages/:handle', async (req, res) => {
  try {
    await connectToDB().catch(console.error);
    let handle = req.params.handle;
    let body = req.body;
    let messages = client.db("Integration_DB").collection("Messages");
    messages.insertOne({
      handle : handle,
      direction : body.direction,
      username : body.username,
      message_type : body.message_type,
      body : body.body,
      composed_at : body.composed_at,
      platform_received_at : body.platform_received_at
    })
    
    res.send({handle : handle});
    client.close();
  } catch(e) {
    console.error(e);
    res.send("Error: " + e);
  }
})


app.listen(process.env.PORT || 3000, 
  () => console.log("The server is running!!!"));